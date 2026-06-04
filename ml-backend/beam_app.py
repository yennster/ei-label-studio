import sys
import os
import random
import string
import xml.etree.ElementTree as ET
import requests
from fastapi import FastAPI, Request, HTTPException, Body
from beam import Image, asgi

app = FastAPI()

# Global variables to cache loaded model and active image embedding
predictor = None
cached_image_url = None
http_session = None

def get_http_session():
    global http_session
    if http_session is None:
        http_session = requests.Session()
    return http_session

def get_predictor():
    global predictor
    if predictor is None:
        print("Loading HQ-SAM (ViT-B) model on GPU...")
        from segment_anything_hq import sam_model_registry, SamPredictor
        sam = sam_model_registry["vit_b"](checkpoint="/app/sam_hq_vit_b.pth")
        sam.to(device="cuda")
        predictor = SamPredictor(sam)
    return predictor

def parse_label_config(xml_string):
    config = {
        'RectangleLabels': {'from_name': 'RectangleLabels', 'to_name': 'image'},
        'BrushLabels': {'from_name': 'BrushLabels', 'to_name': 'image'}
    }
    if not xml_string:
        return config
    try:
        root = ET.fromstring(xml_string)
        for el in root.iter():
            tag = el.tag
            if tag in ['RectangleLabels', 'BrushLabels']:
                name = el.attrib.get('name')
                to_name = el.attrib.get('toName')
                if name and to_name:
                    config[tag] = {'from_name': name, 'to_name': to_name}
    except Exception as e:
        print(f"Error parsing label config: {e}")
    return config

def random_id():
    return ''.join(random.SystemRandom().choices(string.ascii_uppercase + string.ascii_lowercase + string.digits, k=6))

def download_image(url):
    import numpy as np
    import cv2
    session = get_http_session()
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    arr = np.asarray(bytearray(resp.content), dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Failed to decode image")
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return image

def optimized_mask2rle(mask):
    import numpy as np
    arr = mask.ravel()
    n = len(arr)
    if n == 0:
        return []
    y = arr[1:] != arr[:-1]
    i = np.append(np.where(y), n - 1)
    lengths = np.diff(np.append(-1, i)) * 4
    values = arr[i]
    num = 4 * n
    numbits = f'{num:032b}'
    wordsizebits = '00111'
    rle_bits = '0010001101111111'
    base_str = numbits + wordsizebits + rle_bits
    
    out_str_list = []
    for length_reeks, value in zip(lengths, values):
        if length_reeks == 1:
            out_str_list.append(f'000000{value:08b}')
        elif length_reeks > 1:
            if length_reeks <= 8:
                out_str_list.append(f'100{length_reeks - 1:03b}{value:08b}')
            elif length_reeks <= 16:
                out_str_list.append(f'101{length_reeks - 1:04b}{value:08b}')
            elif length_reeks <= 256:
                out_str_list.append(f'110{length_reeks - 1:08b}{value:08b}')
            else:
                length_temp = length_reeks
                while length_temp > 65536:
                    out_str_list.append(f'111{65535:016b}{value:08b}')
                    length_temp -= 65536
                out_str_list.append(f'111{length_temp - 1:016b}{value:08b}')
                
    out_str = ''.join(out_str_list)
    total_str = base_str + out_str
    nzfill = 8 - len(total_str) % 8
    total_str = total_str + nzfill * '0'
    
    rle = [int(total_str[j : j + 8], 2) for j in range(0, len(total_str), 8)]
    return rle

@app.post("/setup")
def setup():
    return {"status": "setup"}

@app.post("/predict")
def predict(payload: dict = Body(...)):
    import numpy as np
    import cv2
    import torch
    
    tasks = payload.get("tasks", [])
    if not tasks:
        raise HTTPException(status_code=400, detail="No tasks provided")

    task = tasks[0]
    image_url = task.get("data", {}).get("image")
    if not image_url:
        raise HTTPException(status_code=400, detail="Task contains no image URL")

    label_config = payload.get("label_config", "")
    config_parsed = parse_label_config(label_config)

    params = payload.get("params", {})
    context = params.get("context") or payload.get("context")
    if not context:
        return {"results": []}

    result = context.get("result", [])
    if not result:
        return {"results": []}

    prompt = result[0]
    prompt_type = prompt.get("type")
    original_height = prompt.get("original_height")
    original_width = prompt.get("original_width")
    value = prompt.get("value", {})

    if not original_height or not original_width:
        raise HTTPException(status_code=400, detail="Missing original_height or original_width in prompt")

    global cached_image_url
    pred = get_predictor()

    with torch.amp.autocast("cuda", dtype=torch.float16):
        if image_url != cached_image_url:
            try:
                print(f"Embedding cache miss. Downloading new image: {image_url}")
                image = download_image(image_url)
                pred.set_image(image)
                cached_image_url = image_url
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"Failed to fetch image: {str(e)}")
        else:
            print(f"Embedding cache hit for: {image_url}")

        if prompt_type == 'keypointlabels':
            x = value.get('x') * original_width / 100.0
            y = value.get('y') * original_height / 100.0
            labels = value.get('labels', ['x'])
            output_label = labels[0] if labels else 'x'

            masks, scores, logits = pred.predict(
                point_coords=np.array([[x, y]]),
                point_labels=np.array([1]),
                multimask_output=False,
            )
        elif prompt_type == 'rectanglelabels':
            x = value.get('x') * original_width / 100.0
            y = value.get('y') * original_height / 100.0
            w = value.get('width') * original_width / 100.0
            h = value.get('height') * original_height / 100.0
            rectangle_labels = value.get('rectanglelabels', ['x'])
            output_label = rectangle_labels[0] if rectangle_labels else 'x'

            masks, scores, logits = pred.predict(
                box=np.array([x, y, x+w, y+h]),
                point_labels=np.array([1]),
                multimask_output=False,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported prompt type: {prompt_type}")

        mask = masks[0].astype(np.uint8)

    contours, hierarchy = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    results = []

    if contours:
        new_contours = []
        for contour in contours:
            new_contours.extend(list(contour))
        new_contours = np.array(new_contours)
        x_box, y_box, w_box, h_box = cv2.boundingRect(new_contours)
        results.append({
            'from_name': config_parsed['RectangleLabels']['from_name'],
            'to_name': config_parsed['RectangleLabels']['to_name'],
            'type': 'rectanglelabels',
            'value': {
                'rectanglelabels': [output_label],
                'x': float(x_box) / original_width * 100.0,
                'y': float(y_box) / original_height * 100.0,
                'width': float(w_box) / original_width * 100.0,
                'height': float(h_box) / original_height * 100.0,
            },
            "id": random_id(),
        })

    mask_255 = mask * 255
    rle = optimized_mask2rle(mask_255)
    results.append({
        "from_name": config_parsed['BrushLabels']['from_name'],
        "to_name": config_parsed['BrushLabels']['to_name'],
        "value": {
            "format": "rle",
            "rle": rle,
            "brushlabels": [output_label],
        },
        "type": "brushlabels",
        "id": random_id(),
        "readonly": False,
    })

    return {"results": [{"result": results}]}

@asgi(
    name="sam-backend",
    cpu=2,
    memory="16Gi",
    gpu="A10G",
    keep_warm_seconds=1200,
    image=Image(python_version="python3.9")
    .add_commands([
        "apt-get update && apt-get install -y git wget libgl1 libglib2.0-0",
        "mkdir -p /app",
        "wget -q -O /app/sam_hq_vit_b.pth https://huggingface.co/lkeab/hq-sam/resolve/main/sam_hq_vit_b.pth"
    ])
    .add_python_packages([
        "fastapi",
        "uvicorn",
        "numpy<2",
        "opencv-python-headless",
        "torch",
        "torchvision",
        "timm==0.4.12",
        "label-studio-converter",
        "boto3",
        "requests",
        "segment-anything-hq"
    ])
)
def run_app():
    return app

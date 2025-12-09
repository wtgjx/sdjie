import json
import urllib.request
import urllib.error
import urllib.parse
import os
import sys
import uuid
import time
import base64
from flask import Flask, request, jsonify, send_from_directory
import sys

# Add parent directory to path to import utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n\n# Vercel Serverless Functions have a read-only filesystem, so we must change the AVATARS_DIR and AVATARS_JSON to /tmp

try:
    import utils
except ImportError:
    utils = None

app = Flask(__name__)

API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
API_KEY = os.environ.get("AI_API_KEY", "3f02c067-2369-4b2f-8cfd-3ec621b43d2b")
AVATARS_DIR = "/tmp/generated_avatars"
AVATARS_JSON = "/tmp/avatars.json"
REF_HAT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "ref_hat.png")

# Ensure avatars dir exists
if not os.path.exists(AVATARS_DIR):
    os.makedirs(AVATARS_DIR, exist_ok=True)

# Initialize avatars.json if not exists
if not os.path.exists(AVATARS_JSON):
    try:
        with open(AVATARS_JSON, 'w') as f:
            json.dump([], f)
    except Exception as e:
        print(f"Could not initialize avatars.json in /tmp: {e}")

@app.route('/api/avatars', methods=['GET'])
def get_avatars():
    """Return list of recent avatars"""
    try:
        with open(AVATARS_JSON, 'r') as f:
            avatars = json.load(f)
        
        # Sort by timestamp desc and take last 20
        avatars.sort(key=lambda x: x['timestamp'], reverse=True)
        recent_avatars = avatars[:20]
        
        return jsonify(recent_avatars), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/proxy_image', methods=['GET'])
def proxy_image():
    """Legacy proxy for remote images"""
    try:
        target_url = request.args.get('url')
        
        if not target_url:
            return "Missing 'url' parameter", 400

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        req = urllib.request.Request(target_url, headers=headers)
        
        with urllib.request.urlopen(req) as response:
            content_type = response.getheader('Content-Type')
            content = response.read()
            
            return content, 200, {'Content-Type': content_type or 'application/octet-stream'}
            
    except Exception as e:
        return f"Proxy Error: {str(e)}", 500

@app.route('/api/generate', methods=['POST'])
def generate_avatar():
    """Generate avatar with Christmas hat using AI"""
    try:
        # 1. Parse incoming JSON
        data = request.get_json()
        image_data = data.get('image') 
        hat_style = data.get('hatStyle', 'red')

        # Clean base64 header from user image if present
        if image_data and image_data.startswith('data:image'):
            try:
                image_data = image_data.split(',', 1)[1]
            except IndexError:
                pass

        # Map hat style to prompt
        hat_prompts = {
            "red": "Add a classic red Christmas hat to the person.",
            "green": "Add a green elf Christmas hat with pointed ears to the person.",
            "antlers": "Add a pair of reindeer antlers headband to the person's head.",
            "xuexitong": "保持人物不变，给这个人物添加一个这个帽子，只需要添加帽子，并且这个帽檐紧贴额头，包裹头，展示帽子全部，不要裁剪，其他不变"
        }
        
        base_prompt = hat_prompts.get(hat_style, hat_prompts['red'])
        style_lock = (
            "保持原图尺寸、画风、光线、色彩、纹理与背景完全不变。"
            "不要插画化、卡通化、重绘、滤镜或任何风格化处理。"
            "只在人物头部添加圣诞帽，贴合额头、包裹头，除帽子以外不改动任何元素。"
            "Keep the original photo size and style, lighting, colors, texture and background unchanged."
            "Do not stylize, cartoonize, repaint or apply filters."
            "Only add a Christmas hat snug to the forehead; change nothing else."
        )
        final_prompt = base_prompt + " " + style_lock

        # Construct Image Payload
        if hat_style == "xuexitong":
            # For Xuexitong, we need multi-image input [user_image, ref_hat]
            try:
                if utils:
                    ref_hat_base64 = utils.get_image_base64(REF_HAT_PATH)
                else:
                    # Fallback: read file directly
                    with open(REF_HAT_PATH, 'rb') as f:
                        ref_hat_base64 = base64.b64encode(f.read()).decode('utf-8')
                
                if not ref_hat_base64:
                     raise Exception("Failed to load reference hat image")
                
                # Ensure user image has prefix
                user_img_str = image_data
                if not user_img_str.startswith('data:image'):
                    user_img_str = f"data:image/png;base64,{user_img_str}"
                    
                # Ensure ref hat has prefix
                ref_hat_str = f"data:image/png;base64,{ref_hat_base64}"
                
                image_payload = [user_img_str, ref_hat_str]
                    
            except Exception as e:
                print(f"Error loading ref hat: {e}")
                # Fallback to single image if ref loading fails
                user_img_str = image_data
                if not user_img_str.startswith('data:image'):
                     user_img_str = f"data:image/png;base64,{user_img_str}"
                image_payload = [user_img_str] 
        else:
            # Single image case
            user_img_str = image_data
            if not user_img_str.startswith('data:image'):
                 user_img_str = f"data:image/png;base64,{user_img_str}"
            image_payload = user_img_str

        payload = {
            "model": "doubao-seedream-4-5-251128",
            "prompt": final_prompt,
            "image": image_payload,
            "sequential_image_generation": "disabled",
            "response_format": "url",
            "stream": False,
            "watermark": False
        }
        
        # 3. Send Request to Volcengine
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        
        req = urllib.request.Request(
            API_URL, 
            data=json.dumps(payload).encode('utf-8'), 
            headers=headers, 
            method='POST'
        )
        
        with urllib.request.urlopen(req) as response:
            response_body = response.read()
            resp_json = json.loads(response_body)
            
            # 4. Handle Image Saving
            if 'data' in resp_json and len(resp_json['data']) > 0:
                image_url = resp_json['data'][0]['url']
                
                # Download the image
                try:
                    img_req = urllib.request.Request(image_url, headers=headers)
                    with urllib.request.urlopen(img_req) as img_resp:
                        img_data = img_resp.read()
                        
                        # Save locally
                        filename = f"{int(time.time())}_{str(uuid.uuid4())[:8]}.png"
                        file_path = os.path.join(AVATARS_DIR, filename)
                        with open(file_path, 'wb') as f:
                            f.write(img_data)
                        
                        # Update JSON
                        with open(AVATARS_JSON, 'r+') as f:
                            avatars = json.load(f)
                            avatars.append({
                                "url": f"/generated_avatars/{filename}",
                                "timestamp": int(time.time())
                            })
                            f.seek(0)
                            json.dump(avatars, f)
                            f.truncate()
                        
                        # Override the URL in response to point to local file
                        resp_json['data'][0]['url'] = f"/generated_avatars/{filename}"
                        response_body = json.dumps(resp_json).encode('utf-8')
                        
                except Exception as e:
                    print(f"Failed to save image locally: {e}")
                    # If save fails, we still return the original response (remote URL)
                    pass

            return jsonify(resp_json), 200
                
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        print(f"API Error: {error_msg}")
        return error_msg, e.code
            
    except Exception as e:
        error_response = {"error": str(e)}
        print(f"Server Error: {str(e)}")
        return jsonify(error_response), 500

# Serve static files from parent directory
# Static files are now served by Vercel's static file server.
# We only need to handle the API routes.

# For Vercel, export the Flask app as 'app'
# Vercel will automatically detect and use this

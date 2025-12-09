import http.server
import socketserver\nfrom http.server import BaseHTTPRequestHandler\nfrom urllib.parse import urlparse, parse_qs
import json
import urllib.request
import urllib.error
import urllib.parse
import os
import sys
import uuid
import time
import base64
import utils  # Import our new utility module

# PORT = 8000 # Removed for Vercel Serverless
API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
API_KEY = os.environ.get("AI_API_KEY", "3f02c067-2369-4b2f-8cfd-3ec621b43d2b")
AVATARS_DIR = "generated_avatars"
AVATARS_JSON = "avatars.json"
REF_HAT_PATH = "ref_hat.png"

# Ensure avatars dir exists
if not os.path.exists(AVATARS_DIR):
    os.makedirs(AVATARS_DIR)

# Initialize avatars.json if not exists
if not os.path.exists(AVATARS_JSON):
    with open(AVATARS_JSON, 'w') as f:
        json.dump([], f)

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):\n        parsed_path = urlparse(self.path)\n        path = parsed_path.path\n        query = parsed_path.query
        if path == '/api/avatars':
            # Return list of recent avatars
            try:
                with open(AVATARS_JSON, 'r') as f:
                    avatars = json.load(f)
                
                # Sort by timestamp desc and take last 20
                avatars.sort(key=lambda x: x['timestamp'], reverse=True)
                recent_avatars = avatars[:20]
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(recent_avatars).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        elif path.startswith('/api/proxy_image'):
            # Legacy proxy, but we might still need it if we used remote URLs.
            # However, new logic will use local URLs. Keep it for compatibility or fallback.
            try:
                # query is already parsed from self.path at the start of do_GET
                params = parse_qs(query)
                target_url = params.get('url', [None])[0]
                
                if not target_url:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Missing 'url' parameter")
                    return

                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
                req = urllib.request.Request(target_url, headers=headers)
                
                with urllib.request.urlopen(req) as response:
                    content_type = response.getheader('Content-Type')
                    content = response.read()
                    
                    self.send_response(200)
                    if content_type:
                        self.send_header('Content-Type', content_type)
                    self.end_headers()
                    self.wfile.write(content)
                    
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Proxy Error: {str(e)}".encode('utf-8'))
        else:
            # For Vercel, static files are served automatically. 
            # We only need to handle the API routes.
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):\n        parsed_path = urlparse(self.path)\n        path = parsed_path.path
        if path == '/api/generate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # 1. Parse incoming JSON
                data = json.loads(post_data.decode('utf-8'))
                image_data = data.get('image') 
                hat_style = data.get('hatStyle', 'red')

                # Clean base64 header from user image if present
                if image_data and image_data.startswith('data:image'):
                    try:
                        image_data = image_data.split(',', 1)[1]
                    except IndexError:
                        pass # Should not happen if startswith checked, but safe to ignore

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
                # API documentation for 'doubao-seedream-4-5-251128' usually expects image URLs or base64 without prefix.
                # Since we are using local images or in-memory base64, we need to be careful.
                # If image_data is base64 string (no prefix), API should handle it.
                
                if hat_style == "xuexitong":
                    # For Xuexitong, we need multi-image input [user_image, ref_hat]
                    try:
                        ref_hat_base64 = utils.get_image_base64(REF_HAT_PATH)
                        if not ref_hat_base64:
                             raise Exception("Failed to load reference hat image")
                            
                        # The API expects image strings to be URLs or Base64 with Data URI scheme
                        # e.g., "data:image/png;base64,..."
                        # Previous attempt with raw base64 failed with "invalid url specified".
                        # Let's add the data URI prefix.
                        
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
                    # Also add prefix to be safe, as API might be strict about "url" format (which includes data URI)
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
                                        "url": f"/{AVATARS_DIR}/{filename}",
                                        "timestamp": int(time.time())
                                    })
                                    f.seek(0)
                                    json.dump(avatars, f)
                                    f.truncate()
                                
                                # Override the URL in response to point to local file
                                # This solves CORS and persistence in one go
                                resp_json['data'][0]['url'] = f"/{AVATARS_DIR}/{filename}"
                                response_body = json.dumps(resp_json).encode('utf-8')
                                
                        except Exception as e:
                            print(f"Failed to save image locally: {e}")
                            # If save fails, we still return the original response (remote URL)
                            pass

                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(response_body)
                    
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_msg = e.read().decode('utf-8')
                print(f"API Error: {error_msg}")
                self.wfile.write(error_msg.encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({"error": str(e)})
                print(f"Server Error: {str(e)}")
                self.wfile.write(error_response.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

# Removed server startup for Vercel Serverless Function

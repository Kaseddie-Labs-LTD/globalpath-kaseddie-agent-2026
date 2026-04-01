import os
import asyncio
import fal_client
import replicate
from dotenv import load_dotenv
from fastapi import HTTPException

# Load environment variables
load_dotenv()

# Set API tokens
FAL_KEY = os.getenv("VITE_FAL_KEY")
REPLICATE_API_TOKEN = os.getenv("VITE_REPLICATE_API_TOKEN")

# Ensure fal_client uses the key
if FAL_KEY:
    os.environ["FAL_KEY"] = FAL_KEY

# Configure replicate token if available
if REPLICATE_API_TOKEN:
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

async def generate_flux_image(prompt: str):
    """
    Generates a Cyberpunk/Glassmorphism style image using Fal.ai's Flux model.
    """
    refined_prompt = f"Cyberpunk, Glassmorphism style: {prompt}. High-tech, futuristic, professional recruitment aesthetic, vibrant neon accents, sleek glass textures, 8k resolution."
    
    try:
        print(f"Generating image for prompt: {refined_prompt}")
        # Wrap the sync call in a thread to prevent blocking the entire backend
        loop = asyncio.get_event_loop()
        
        result = await loop.run_in_executor(
            None,
            lambda: fal_client.subscribe(
                "fal-ai/flux/schnell",
                arguments={
                    "prompt": refined_prompt,
                    "image_size": "landscape_16_9",
                    "num_inference_steps": 4,
                    "enable_safety_checker": True
                },
                with_logs=True,
            )
        )
        
        if result and "images" in result and len(result["images"]) > 0:
            image_url = result["images"][0]["url"]
            print(f"Image generated successfully: {image_url}")
            return image_url
        else:
            print("No images found in Fal.ai result.")
            return None
            
    except Exception as e:
        print(f"Error generating image with Fal.ai: {str(e)}")
        return None

async def generate_kling_video(image_url: str):
    """
    Animates the generated image into a 5-second professional recruitment video using Replicate's Kling model.
    """
    if not image_url:
        print("No image URL provided for video generation.")
        return None
        
    try:
        print(f"Generating video from image: {image_url}")
        # Wrap the sync call in a thread to prevent blocking the entire backend
        loop = asyncio.get_event_loop()
        
        # Ensure your REPLICATE_API_TOKEN is set in .env
        prediction = await loop.run_in_executor(
            None,
            lambda: replicate.run(
                "lucataco/kling-v1.5:41408f6540c765063991219b10928a6d634282c009d17208d259c071d3c01f63", # Using the provided model or a stable version
                input={
                    "image": image_url,
                    "prompt": "Professional recruitment promo video, subtle camera movement, cinematic lighting, high quality, 5 seconds.",
                    "duration": 5
                }
            )
        )
        
        if not prediction:
            print("❌ Video Generation Failed: No prediction output")
            return None
            
        print(f"Video generated successfully: {prediction}")
        return prediction # This should be the URL to the video
    except Exception as e:
        print(f"❌ Video Error: {str(e)}")
        return None

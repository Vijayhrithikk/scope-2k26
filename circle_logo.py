from PIL import Image, ImageOps, ImageDraw
import os

def make_circular(path_in, path_out):
    if not os.path.exists(path_in):
        print(f"Error: {path_in} not found")
        return

    img = Image.open(path_in).convert("RGBA")
    
    # Create circular mask
    size = (min(img.size), min(img.size))
    # Crop to center square if not square
    img = ImageOps.fit(img, size, centering=(0.5, 0.5))
    
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + size, fill=255)
    
    img.putalpha(mask)
    img.save(path_out)
    print(f"Saved circular logo to {path_out}")

# Try to find the logo
if os.path.exists("public/scope-logo.jpeg"):
    make_circular("public/scope-logo.jpeg", "public/scope-logo-circle.png")
elif os.path.exists("scope-logo.jpeg"):
    make_circular("scope-logo.jpeg", "public/scope-logo-circle.png")
else:
    # Try finding any logo
    files = [f for f in os.listdir("public") if "logo" in f.lower() and f.endswith((".jpg", ".jpeg", ".png"))]
    if files:
        print(f"Using {files[0]}")
        make_circular(os.path.join("public", files[0]), "public/scope-logo-circle.png")
    else:
        print("No logo found to process")

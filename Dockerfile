# Use a stable version of Python (fixes the Pillow 3.14 issue)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Ensure the static directory exists so FastAPI doesn't throw an error on boot
RUN mkdir -p static

# Hugging Face Spaces require applications to run on port 7860
EXPOSE 7860

# Run the FastAPI server using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
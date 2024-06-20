# Use a lightweight base image with Python
FROM python:3.12-alpine

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install dependencies
RUN apk update && apk add postgresql-dev gcc python3-dev musl-dev

# Set the working directory
WORKDIR /app

# Copy the requirements file and install dependencies
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . /app

# Expose the port the app runs on
EXPOSE 5052

# Command to run the application
CMD ["python", "main.py"]

# docker image build -t hutterite-bookshelf .
# docker run -p 5000:5000 -d hutterite-bookshelf
# docker tag hutterite-bookshelf jarebear/hutterite-bookshelf
# docker push jarebear/hutterite-bookshelf
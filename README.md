# Hutterite Bookshelf

A public archive of hutterian documents.
To deploy your Flask application running in Docker on your Synology NAS and set it up with a custom domain name, follow these steps:

## Setup

### 1. **Prepare Your Synology NAS**

Ensure your Synology NAS has Docker installed. If not, install Docker from the Synology Package Center.

### 2. **Build and Push Docker Image**

#### Build the Docker Image Locally
Make sure your `Dockerfile`, `requirements.txt`, and `app.py` are ready. Then, build the Docker image locally:

```bash
docker build -t flask-app .
```

#### Push the Docker Image to Docker Hub (optional)
If you want to push the image to Docker Hub, you can do so. Replace `your-docker-username` with your actual Docker Hub username:

```bash
docker tag flask-app your-docker-username/flask-app
docker push your-docker-username/flask-app
```

### 3. **Set Up Docker Container on Synology NAS**

#### Pull Docker Image on Synology NAS (if pushed to Docker Hub)
If you pushed the image to Docker Hub, pull it on your Synology NAS:

1. Open Docker from the main menu.
2. Go to the "Registry" tab and search for your Docker Hub image (`your-docker-username/flask-app`).
3. Download the image.

#### Create and Run the Docker Container
1. Go to the "Image" tab, find your image, and click "Launch" to create a new container.
2. Configure the container settings:
   - **General Settings**: Set a container name.
   - **Advanced Settings**: Enable auto-restart and set environment variables if needed.
   - **Volume**: Mount any necessary volumes.
   - **Network**: Make sure the container is in the correct network. Usually, bridge mode is fine.
   - **Port Settings**: Use port 5052 for local and container port. (Leave as TCP)

### 4. **Configure Reverse Proxy on Synology NAS**

To use your custom domain, you'll need to set up a reverse proxy:

1. Open Synology DSM and go to "Control Panel".
2. Go to "Application Portal" and then the "Reverse Proxy" tab.
3. Click "Create" and configure the following:
   - **Description**: Give it a name (e.g., Flask App).
   - **Source**:
     - Protocol: HTTP
     - Hostname: `hutteritebookshelf.hbni.net`
     - Port: 80
   - **Destination**:
     - Protocol: HTTP
     - Hostname: `localhost`
     - Port: 5052 (or the port you mapped in Docker)

### 5. **Set Up Domain and DNS**

Ensure your domain `hutteritebookshelf.hbni.net` points to your Synology NAS's public IP address. Update your DNS records with your domain registrar:

1. Log in to your domain registrar's website.
2. Go to the DNS settings for `hutteritebookshelf.hbni.net`.
3. Add an A record pointing to your Synology NAS's public IP address.

### 6. **Secure with HTTPS (Optional but Recommended)**

Use Let’s Encrypt to secure your domain with HTTPS:

1. Go to "Control Panel" > "Security" > "Certificate".
2. Click "Add" and select "Get a certificate from Let's Encrypt".
3. Follow the prompts to issue a certificate for `hutteritebookshelf.hbni.net`.

### 7. **Verify Your Setup**

Open a web browser and navigate to `http://hutteritebookshelf.hbni.net` or `https://hutteritebookshelf.hbni.net` if you set up HTTPS. Your Flask application should be running.

### Summary

- Build and push your Docker image if needed.
- Pull the image and run it on your Synology NAS.
- Set up a reverse proxy in Synology DSM.
- Update DNS records to point your domain to your NAS.
- Secure with HTTPS using Let’s Encrypt.

By following these steps, your Flask application should be accessible via your custom domain hosted on your Synology NAS.
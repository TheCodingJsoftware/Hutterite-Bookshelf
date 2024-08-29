<p align="center">
    <img src="static/icons/icon.png" style="border-radius: 50%; width: 200px; border: 1px solid gray;"/>
</p>

# Hutterite Bookshelf

A comprehensive app for accessing, managing, and sharing Hutterite literature.

## Status

<p align="left">
    <a><img src="https://img.shields.io/github/created-at/TheCodingJsoftware/Hutterite-Bookshelf"/></a>
    <a><img src="https://img.shields.io/github/license/TheCodingJsoftware/Hutterite-Bookshelf"/></a>
    <a><img src="https://img.shields.io/github/repo-size/TheCodingJsoftware/Hutterite-Bookshelf?label=Size"/></a>
    <a><img src="https://img.shields.io/github/commit-activity/m/TheCodingJsoftware/Hutterite-Bookshelf"/></a>
    <a><img src="https://img.shields.io/github/languages/count/TheCodingJsoftware/Hutterite-Bookshelf"></a>
    <a><img src="https://img.shields.io/github/languages/top/TheCodingJsoftware/Hutterite-Bookshelf"></a>
    <a><img src="https://img.shields.io/badge/python-3.12-blue"></a>
    <a><img src="https://img.shields.io/docker/automated/jarebear/hutterite-bookshelf"></a>
</p>

## Activity

![Alt](https://repobeats.axiom.co/api/embed/6c3f53db95af4432c92064ad6878445462a95ab8.svg "Repobeats analytics image")

## Technologies Used

<p align="center">
    <a><img src="https://github.com/tornadoweb/tornado/blob/stable/docs/tornado.png?raw=true"></a>
    <br>
    <br>
    <a><img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=fff"></a>
    <a><img src="https://img.shields.io/badge/Postgres-%23316192.svg?logo=postgresql&logoColor=white"></a>
    <a><img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff"></a>
    <a><img src="https://img.shields.io/badge/HTML-%23E34F26.svg?logo=html5&logoColor=white"></a>
    <a><img src="https://img.shields.io/badge/CSS-1572B6?logo=css3&logoColor=fff"></a>
    <a><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff"></a>
</p>

## Development Setup

1. Install [Node.js](https://nodejs.org/en/download/).
2. Install [Git](https://git-scm.com/downloads).
3. Install [Python](https://www.python.org/downloads/).
4. Clone the repository with

    ```bash
    git clone https://github.com/TheCodingJsoftware/Hutterite-Bookshelf.git
    ```

5. Run `npm install` to install the dependencies.
6. Setup a virtual environment with `python -m virtualenv venv`.
7. Activate the virtual environment with `source venv/bin/activate` or run `venv\Scripts\activate.bat` on Windows.
8. Install the dependencies with `pip install -r requirements.txt`.
9. Run `npm run build` to build the app.
10. Setup enviroment variables in the `.env` file:

    ```bash
    POSTGRES_USER=your_username
    POSTGRES_PASSWORD=your_password
    POSTGRES_DB=your_database
    POSTGRES_HOST=localhost
    POSTGRES_PORT=5434
    MAX_POSTGRES_WORKERS=50
    ```

11. Run `python main.py` to start the app.

## Setup on Synology NAS

To deploy your application running in Docker on your Synology NAS and set it up with a custom domain name, follow these steps:

### 1. **Prepare Your Synology NAS**

Ensure your Synology NAS has Docker installed. If not, install Docker from the Synology Package Center.

### 2. **Build and Push Docker Image**

#### Build the Docker Image Locally

Make sure your `Dockerfile`, `requirements.txt`, and `main.py` are ready. Then, build the Docker image locally:

```bash
docker build -t app-name .
```

#### Push the Docker Image to Docker Hub (optional)

If you want to push the image to Docker Hub, you can do so. Replace `your-docker-username` with your actual Docker Hub username:

```bash
docker tag app-name your-docker-username/app-name
docker push your-docker-username/app-name
```

### 3. **Set Up Docker Container on Synology NAS**

#### Pull Docker Image on Synology NAS (if pushed to Docker Hub)

If you pushed the image to Docker Hub, pull it on your Synology NAS:

1. Open Docker from the main menu.
2. Go to the "Registry" tab and search for your Docker Hub image (`your-docker-username/app-name`).
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
4. Make sure websockets are enabled.
    - Open Control Panel > Application Portal
    - Change to the Reverse Proxy tab
    - Select the proxy rule for which you want to enable Websockets and click on Edit
    - Change to the Custom Headers tab
    - Add two entries in the list:
      - Name: `Upgrade`, Value: `$http_upgrade`
      - Name: `Connection`, Value: `$connection_upgrade`

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

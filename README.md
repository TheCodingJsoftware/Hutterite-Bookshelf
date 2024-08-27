<p align="center">
    <img src="static/icon.png" style="border-radius: 50%;"/>
</p>

# Hutterite Bookshelf

Your own bookshelf of Hutterite songs.

## Status

<p align="center">
    <a><img src="https://img.shields.io/github/created-at/TheCodingJsoftware/Hutterite-Bookshelf?style=for-the-badge"/></a>
    <a><img src="https://img.shields.io/github/license/TheCodingJsoftware/Hutterite-Bookshelf?&style=for-the-badge"/></a>
    <a><img src="https://img.shields.io/github/repo-size/TheCodingJsoftware/Hutterite-Bookshelf?label=Size&style=for-the-badge"/></a>
    <a><img src="https://img.shields.io/github/commit-activity/m/TheCodingJsoftware/Hutterite-Bookshelf?style=for-the-badge"/></a>
    <a><img src="https://img.shields.io/github/languages/count/TheCodingJsoftware/Hutterite-Bookshelf?style=for-the-badge"></a>
    <a><img src="https://img.shields.io/github/languages/top/TheCodingJsoftware/Hutterite-Bookshelf?style=for-the-badge"></a>
    <a><img src="https://img.shields.io/badge/python-3.12-blue?style=for-the-badge"></a>
    <a><img src="https://img.shields.io/docker/automated/jarebear/hutterite-bookshelf?style=for-the-badge"></a>
</p>

## Activity

![Alt](https://repobeats.axiom.co/api/embed/6c3f53db95af4432c92064ad6878445462a95ab8.svg "Repobeats analytics image")

## Technologies Used

<p align="center">
    <a><img src="https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white"></a>
    <a><img src="https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white"></a>
    <a><img src="https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54"></a>
    <a><img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white"></a>
    <a><img src="https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white"></a>
    <a><img src="https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white"></a>
</p>

## Setup

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
10. Create `POSTGRES.json` in the root directory with the following content:
    ```json
    {
        "POSTGRES_USER": "YOUR_POSTGRES_USER",
        "POSTGRES_PASSWORD": "YOUR_POSTGRES_PASSWORD",
        "POSTGRES_DB": "YOUR_POSTGRES_DB",
        "POSTGRES_HOST": "YOUR_POSTGRES_HOST",
        "POSTGRES_PORT": "YOUR_POSTGRES_PORT",
    }
10. Run `python main.py` to start the app.

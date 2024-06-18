# start by pulling the python image
FROM python:3.12-alpine

# copy the requirements file into the image
COPY ./requirements.txt /app/requirements.txt

# switch working directory
WORKDIR /app

# install the dependencies and packages in the requirements file
RUN pip install -r requirements.txt

# copy every content from the local file to the image
COPY . /app

# configure the container to run in an executed manner
ENTRYPOINT [ "python" ]

CMD ["main.py" ]

# docker image build -t hutterite-bookshelf .
# docker run -p 5000:5000 -d hutterite-bookshelf
# docker tag hutterite-bookshelf jarebear/hutterite-bookshelf
# docker push jarebear/hutterite-bookshelf
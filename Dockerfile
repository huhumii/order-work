FROM python:3.12-alpine

WORKDIR /app

COPY index.html app.js sync.js styles.css cook.json server.py /app/
RUN mkdir -p /app/data

EXPOSE 80

ENV PORT=80
ENV ORDER_DATA_DIR=/app/data

CMD ["python", "server.py"]

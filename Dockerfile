FROM python:3.12-alpine

WORKDIR /app

COPY index.html app.js sync.js styles.css cook.json server.py /app/
RUN mkdir -p /app/data

EXPOSE 80

ENV PORT=80
ENV ORDER_DATA_DIR=/app/data

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import json, urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1/api/health', timeout=3)); raise SystemExit(0 if data.get('ok') else 1)"

CMD ["python", "server.py"]

#!/bin/bash
# Run the sandbox agent container
# A2A: http://localhost:9000
# Desktop view: http://localhost:6080/vnc.html

docker run -d \
    --name ron-sandbox \
    -p 9000:9000 \
    -p 6080:6080 \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -e AWS_REGION=${AWS_REGION:-us-east-1} \
    ronbrowser-sandbox

echo "Sandbox agent running:"
echo "  A2A: http://localhost:9000"
echo "  Desktop: http://localhost:6080/vnc.html"

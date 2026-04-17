import os
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from document_parser.parser import parse_document, ParserError

app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc"}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/parse-document", methods=["POST"])
def parse_document_endpoint():
    if "file" not in request.files:
        return jsonify({"error": "No file field in request"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not _allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type. Upload a PDF or Word document (.docx)"}), 415

    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[1].lower()

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp_path = tmp.name
        file.save(tmp_path)

    try:
        result = parse_document(tmp_path, original_filename=filename)
        return jsonify(result), 200
    except ParserError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"Unexpected error during parsing: {str(e)}"}), 500
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    app.run(debug=True, port=5000)

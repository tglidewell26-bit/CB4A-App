import io
import os
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from document_parser.parser import parse_document, ParserError
from workbook_generator.generator import generate_student_workbook, GeneratorError

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


@app.route("/generate/student", methods=["POST"])
def generate_student_endpoint():
    """
    Generate a Student Workbook .docx from a parsed chapter JSON.

    Request body (JSON):
        {
            "chapter_json": { ...Module 2 output... },
            "grade": 3          # optional if already in chapter_json
        }

    Response: downloadable .docx file.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON"}), 400

    chapter_json = body.get("chapter_json")
    if not chapter_json:
        return jsonify({"error": "'chapter_json' field is required"}), 400

    grade = body.get("grade") or chapter_json.get("grade")

    try:
        docx_buf = generate_student_workbook(chapter_json, grade=grade)
    except GeneratorError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    book = chapter_json.get("book_title", "workbook").replace(" ", "_")
    ch = chapter_json.get("chapter_num", "ch")
    filename = f"{book}_Ch{ch}_Grade{grade}_Student_Workbook.docx"

    return send_file(
        docx_buf,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)

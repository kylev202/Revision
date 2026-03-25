"""
PDF text extraction module.
Uses PyMuPDF (fitz) to extract text from uploaded PDF files.
"""

import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract all text from a PDF file's bytes.
    Returns the full text as a single string.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text = []

    for page in doc:
        text = page.get_text()
        if text.strip():
            pages_text.append(text.strip())

    doc.close()
    return "\n\n".join(pages_text)

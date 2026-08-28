#!/usr/bin/env python3
"""Invia la coda password-reset di Oracle tramite un account SMTP esterno."""

from __future__ import annotations

import base64
import html
import os
import re
import smtplib
import ssl
import time
from email.message import EmailMessage

import oracledb


GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Variabile obbligatoria mancante: {name}")
    return value


def create_message(recipient: str, subject: str, body: str) -> EmailMessage:
    username = os.environ.get("TAOTL_SMTP_USERNAME", "").strip()
    sender = os.environ.get("TAOTL_MAIL_FROM", "").strip()
    if not sender:
        sender = os.environ.get("TAOTL_SMTP_FROM", username).strip()
    if not sender:
        raise RuntimeError("Variabile obbligatoria mancante: TAOTL_MAIL_FROM")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message["Auto-Submitted"] = "auto-generated"
    message.set_content(body)
    code_match = re.search(r"(?m)^([0-9]{8})$", body)
    greeting_match = re.search(r"^Ciao ([^,\r\n]+),", body)
    if code_match:
        code = html.escape(code_match.group(1))
        display_name = html.escape(greeting_match.group(1) if greeting_match else "")
        greeting = f"Ciao {display_name}," if display_name else "Ciao,"
        message.add_alternative(
            f"""<!doctype html>
<html lang="it"><body style="margin:0;background:#f5f1e8;color:#1d2433;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border:1px solid #ddd5c6;border-radius:18px;padding:28px">
      <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#8b5e34">TAOTL</div>
      <h1 style="font-size:24px;margin:14px 0 20px">Reimposta la password</h1>
      <p style="font-size:16px;line-height:1.6">{greeting}</p>
      <p style="font-size:16px;line-height:1.6">Ecco il codice da inserire nell'app:</p>
      <div style="margin:24px 0;padding:18px;border-radius:12px;background:#1d2433;color:#ffffff;text-align:center;font-family:monospace;font-size:34px;font-weight:700;letter-spacing:7px">{code}</div>
      <p style="font-size:14px;line-height:1.6;color:#596273">Il codice scade tra 5 minuti. Un nuovo invio rende subito non valido quello precedente.</p>
      <p style="font-size:14px;line-height:1.6;color:#596273">Se non hai richiesto tu il recupero, puoi ignorare questa email.</p>
    </div>
  </div>
</body></html>""",
            subtype="html",
        )
    return message


def send_via_smtp(message: EmailMessage) -> None:
    host = required("TAOTL_SMTP_HOST")
    port = int(os.environ.get("TAOTL_SMTP_PORT", "465"))
    username = required("TAOTL_SMTP_USERNAME")
    password = required("TAOTL_SMTP_PASSWORD")
    use_ssl = os.environ.get("TAOTL_SMTP_SSL", "true").lower() == "true"

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as client:
            client.login(username, password)
            client.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=30) as client:
            client.starttls(context=ssl.create_default_context())
            client.login(username, password)
            client.send_message(message)


def send_via_gmail_api(message: EmailMessage) -> None:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    token_file = required("TAOTL_GMAIL_TOKEN_FILE")
    credentials = Credentials.from_authorized_user_file(token_file, [GMAIL_SEND_SCOPE])
    if not credentials.valid:
        if not credentials.expired or not credentials.refresh_token:
            raise RuntimeError("Autorizzazione Gmail non valida: ripetere il collegamento OAuth.")
        credentials.refresh(Request())

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")
    service = build("gmail", "v1", credentials=credentials, cache_discovery=False)
    service.users().messages().send(userId="me", body={"raw": raw_message}).execute()


def send_message(recipient: str, subject: str, body: str) -> None:
    message = create_message(recipient, subject, body)
    transport = os.environ.get("TAOTL_MAIL_TRANSPORT", "smtp").strip().lower()
    if transport == "gmail_api":
        send_via_gmail_api(message)
        return
    if transport == "smtp":
        send_via_smtp(message)
        return
    raise RuntimeError(f"Trasporto email non supportato: {transport}")


def main() -> None:
    connection = oracledb.connect(
        user="taotl_app",
        password=required("TAOTL_SCHEMA_PASSWORD"),
        dsn=os.environ.get("TAOTL_ORACLE_DSN", "MYATP_high_tls"),
        config_dir=required("TAOTL_ORACLE_WALLET_DIR"),
        wallet_location=required("TAOTL_ORACLE_WALLET_DIR"),
        wallet_password=required("ORACLE_WALLET_PASSWORD"),
    )
    while True:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM taotl_mail_outbox WHERE created_at < SYSTIMESTAMP - INTERVAL '30' MINUTE")
            cursor.execute(
                "SELECT id, recipient, subject, body_text FROM taotl_mail_outbox "
                "WHERE attempts < 5 ORDER BY created_at FETCH FIRST 10 ROWS ONLY"
            )
            messages = cursor.fetchall()
            connection.commit()

        for message_id, recipient, subject, body in messages:
            try:
                send_message(recipient, subject, body)
                with connection.cursor() as cursor:
                    cursor.execute("DELETE FROM taotl_mail_outbox WHERE id = :id", id=message_id)
                connection.commit()
            except Exception as error:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "UPDATE taotl_mail_outbox SET attempts=attempts+1, last_error=:error WHERE id=:id",
                        error=str(error)[:1000], id=message_id,
                    )
                connection.commit()
        time.sleep(10)


if __name__ == "__main__":
    main()

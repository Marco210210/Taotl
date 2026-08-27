#!/usr/bin/env python3
"""Invia la coda password-reset di Oracle tramite un account SMTP esterno."""

from __future__ import annotations

import os
import smtplib
import ssl
import time
from email.message import EmailMessage

import oracledb


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Variabile obbligatoria mancante: {name}")
    return value


def send_message(recipient: str, subject: str, body: str) -> None:
    host = required("TAOTL_SMTP_HOST")
    port = int(os.environ.get("TAOTL_SMTP_PORT", "465"))
    username = required("TAOTL_SMTP_USERNAME")
    password = required("TAOTL_SMTP_PASSWORD")
    sender = os.environ.get("TAOTL_SMTP_FROM", username).strip()
    use_ssl = os.environ.get("TAOTL_SMTP_SSL", "true").lower() == "true"

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as client:
            client.login(username, password)
            client.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=30) as client:
            client.starttls(context=ssl.create_default_context())
            client.login(username, password)
            client.send_message(message)


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

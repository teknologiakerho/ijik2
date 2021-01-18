import contextlib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
import functools
import logging
import smtplib
import ijik

class Message:

    subject = ""
    text = ""
    to_addr = ""
    to_name = ""
    bcc = ()
    attachments = ()

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    @property
    def to(self):
        return f"{self.to_name} <{self.to_addr}>"

    def __repr__(self):
        return (
            f"Subject: {self.subject}\n"
            f"To: {self.to}\n"
            f"Bcc: {self.bcc}\n"
            "\n"
            f"{self.text}"
        )

class TemplateMessage(Message):

    @functools.cached_property
    def text(self):
        return self.template.render(message=self)

# XXX: this is blocking, an async implementation should be used for non-localhost servers
# (run in asyncio.get_running_loop())
class SMTPLibSender:

    def __init__(self,
            username,
            password,
            from_addr=None,
            sender=None,
            starttls=False,
            bcc=(),
            **smtp_args
        ):

        self.login = (username, password)
        self.from_addr = from_addr or username 
        self.sender = sender or f"<{self.from_addr}"
        self.starttls = starttls
        self.bcc = bcc
        self.smtp_args = {
            "host": "localhost",
            "port": 587,
            **smtp_args
        }

    @contextlib.contextmanager
    def __call__(self):
        with smtplib.SMTP(**self.smtp_args) as smtp:
            if self.starttls:
                smtp.starttls()
                smtp.ehlo()

            if self.login:
                smtp.login(*self.login)

            yield functools.partial(self._send, smtp)

    def _send(self, smtp, message):
        mes = EmailMessage()
        mes["Subject"] = message.subject
        mes["From"] = self.sender
        mes["To"] = message.to
        mes["Message-ID"] = make_msgid(self.smtp_args["host"])
        mes["Date"] = formatdate(localtime=True)
        mes.set_content(message.text)

        for name,content in message.attachments:
            # TODO: this should probably handle mime types properly
            mes.add_attachment(
                    content,
                    filename=name,
                    maintype="application",
                    subtype="octet-stream"
            )

        smtp.send_message(mes,
                from_addr=self.from_addr,
                to_addrs=(message.to_addr, *self.bcc, *message.bcc)
        )

# For debugging
class LogSender:

    def __init__(self, logger=logging.getLogger("ijik")):
        self.logger = logger

    @contextlib.contextmanager
    def __call__(self):
        yield self._send

    def _send(self, message):
        self.logger.info(f"Sending email -- {message}")

from setuptools import setup

setup(
    name = "ijik",
    version = "0.0.1",
    packages = [ "ijik" ],
    install_requires = [
        "aiofiles",
        "base58",
        "email-validator",
        "fastapi",
        "jinja2",
        "pluggy==1.0.0dev0",
        "python-multipart",
        "sqlalchemy==1.4.0b1"
    ]
)

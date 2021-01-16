from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import ijik

__all__ = ["FastAPIErrorsPlugin"]

def validation_error_cause(error):
    # could do something based on error.type here
    cause = error["msg"]

    # strip location (body, query, etc.) added by fastapi
    loc = error["loc"][1:]

    # skip root validator
    if loc[0] == "__root__":
        loc = loc[1:]

    for l in loc[::-1]:
        cause = { l: cause }

    return cause

class FastAPIErrorsPlugin:

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        api = app.api

        # we return a 422 for validation errors here and a 400 for other cancels.
        # 400 may not be the most suitable code for this, but i want to separate it from pydantic
        # errors.
        # fwiw, this guy suggests to use 400:
        #    https://mlk.nfshost.com/choosing-an-http-status-code/HTTP-4XX-Status-Codes.svg

        @api.exception_handler(ijik.Cancel)
        async def pydantic_validation_error(request, exc):
            return JSONResponse(status_code=400, content=exc.dict())

        @api.exception_handler(RequestValidationError)
        async def pydantic_validation_error(request, exc):
            # can't raise cancel here, fastapi won't handle recursive errors
            return JSONResponse(
                    status_code=422,
                    content=ijik.Errors(*map(validation_error_cause, exc.errors())).dict()
            )

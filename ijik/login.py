class AuthkeyLogin:

    def __init__(self, get, cookie_name="authkey", **cookie_kwargs):
        self.get = get
        self.cookie_name = cookie_name
        self.cookie_kwargs = cookie_kwargs

    def get_key(self, request):
        return request.cookies.get(self.cookie_name)

    def get_login(self, request, *args, **kwargs):
        key = self.get_key(request)

        if not key:
            return

        return self.get(key, *args, **kwargs)

    def login(self, response, key, **cookie_kwargs):
        response.set_cookie(self.cookie_name, key, **cookie_kwargs)

    def logout(self, response):
        response.delete_cookie(self.cookie_name)

def authkey_login(**kwargs):
    def ret(f):
        return AuthkeyLogin(f, **kwargs)
    return ret

from . import create_app

app = create_app()

# For WSGI servers (gunicorn, uWSGI)
# gunicorn entry: gunicorn 'app.wsgi:app'
import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from backend.app import app

port = int(os.environ.get('PORT', 5000))

if __name__ == '__main__':
    print(f"Starting Solar AI Backend API from root launcher on http://127.0.0.1:{port}")
    app.run(host='127.0.0.1', port=port, debug=False)

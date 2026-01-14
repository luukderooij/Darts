import logging
import sys
from collections import deque

# 1. The Shared Buffer
# This holds the last 100 log messages in memory.
# It is exported so websockets.py can import it and send it to the frontend.
log_buffer = deque(maxlen=100)

class BufferHandler(logging.Handler):
    """Custom handler that pushes logs into the deque."""
    def emit(self, record):
        try:
            msg = self.format(record)
            log_buffer.append(msg)
        except Exception:
            self.handleError(record)

def setup_logging():
    """Configures the logger to write to Console, File, and WebSocket Buffer."""
    logger = logging.getLogger("dart_app")
    logger.setLevel(logging.INFO)
    
    # Prevent adding handlers multiple times if the app reloads
    if logger.hasHandlers():
        return logger

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

    # A. Console Handler (Print to terminal)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # B. File Handler (Save to disk)
    # The 'logs' folder was created by our structure script
    try:
        file_handler = logging.FileHandler("logs/app.log")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except FileNotFoundError:
        print("Warning: logs directory not found. Skipping file logging.")

    # C. Buffer Handler (For WebSockets)
    buffer_handler = BufferHandler()
    buffer_handler.setFormatter(formatter)
    logger.addHandler(buffer_handler)

    return logger

# Initialize immediately so it runs on import
logger = setup_logging()
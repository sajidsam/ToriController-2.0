import serial
import time
import sys

try:
    ser = serial.Serial('/dev/tty.usbmodem101', 115200, timeout=1)
    print("Opened port!")
    time.sleep(2) # Wait for ESP to boot
    ser.write(b"DIR:FWD\n")
    print("Sent DIR:FWD")
    
    # Read output
    for _ in range(5):
        line = ser.readline()
        if line:
            print("RX:", line.decode(errors='replace').strip())
            
    ser.close()
except Exception as e:
    print("Error:", e)

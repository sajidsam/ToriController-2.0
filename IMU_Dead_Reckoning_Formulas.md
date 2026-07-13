# Mathematical Formulas for IMU-Based Dead Reckoning

This document contains the complete mathematical models and formulas used for the AUV's Inertial Measurement Unit (IMU) dead reckoning system. It is formatted to be easily exported to a PDF.

---

## 1. Sensor Calibration

Raw sensor data from the MPU9250 contains inherent biases and distortions that must be corrected before filtering.

**Accelerometer & Gyroscope (Zero-Bias Correction):**
$$a_{cal} = a_{raw} - a_{bias}$$
$$\omega_{cal} = \omega_{raw} - \omega_{bias}$$
_(Where $a$ is acceleration and $\omega$ is angular velocity)._

**Magnetometer (Hard & Soft Iron Correction):**
$$m_{cal} = W \cdot (m_{raw} - V)$$

- $V$: Hard-iron offset vector (shifts the magnetic sphere to origin).
- $W$: Soft-iron distortion matrix (corrects elliptical distortion into a sphere).

---

## 2. Quaternion to Euler Angles

The Madgwick AHRS filter computes a 3D orientation quaternion $q = [q_0, q_1, q_2, q_3]$. To convert this into human-readable Euler angles (Roll $\phi$, Pitch $\theta$, Yaw $\psi$):

**Roll (X-axis rotation):**
$$\phi = \arctan\left(\frac{2(q_0q_1 + q_2q_3)}{1 - 2(q_1^2 + q_2^2)}\right)$$

**Pitch (Y-axis rotation):**
$$\theta = \arcsin\left(2(q_0q_2 - q_3q_1)\right)$$

**Yaw / Heading (Z-axis rotation):**
$$\psi = \arctan\left(\frac{2(q_0q_3 + q_1q_2)}{1 - 2(q_2^2 + q_3^2)}\right)$$

---

## 3. Gravity Compensation

The accelerometer measures both the vehicle's dynamic acceleration and Earth's gravity ($1g$). To isolate the vehicle's movement (Linear Acceleration), the gravity vector must be subtracted.

**Gravity Vector in Body Frame:**
$$g_x = 2(q_1q_3 - q_0q_2)$$
$$g_y = 2(q_0q_1 + q_2q_3)$$
$$g_z = q_0^2 - q_1^2 - q_2^2 + q_3^2$$

**Linear Acceleration:**
$$a_{lin} = a_{cal} - g$$

---

## 4. Body to Earth Coordinate Transformation (Yaw Rotation)

Before numerical integration, the local Body-Frame linear acceleration ($a_{lin\_X}, a_{lin\_Y}$) is rotated into the Earth-Frame ($a_{Earth\_X}, a_{Earth\_Y}$) using the **Yaw ($\psi$)** angle. Pitch and Roll are intentionally ignored in this specific model.

**2D Rotation Matrix (Yaw Only):**
$$a_{Earth\_X} = a_{lin\_X} \cdot \cos(\psi) - a_{lin\_Y} \cdot \sin(\psi)$$
$$a_{Earth\_Y} = a_{lin\_X} \cdot \sin(\psi) + a_{lin\_Y} \cdot \cos(\psi)$$

---

## 5. ZUPT Extended Kalman Filter (EKF)

To combat exponential integration drift and optimal signal smoothing, a **2-State Extended Kalman Filter** is implemented for each axis independently using Matrix mathematics. Because underwater dead reckoning lacks an absolute position update (like GPS), the filter relies on a **Zero Velocity Update (ZUPT)** pseudo-measurement as its correction step.

### 5.1. State Matrices Definition
For a single axis (e.g., X-Axis), the state vector $X$ tracks both Position ($p$) and Velocity ($v$):
$$X = \begin{bmatrix} p \\ v \end{bmatrix}$$

- **State Transition Matrix ($F$):** $F = \begin{bmatrix} 1 & \Delta t \\ 0 & 1 \end{bmatrix}$
- **Control Matrix ($B$):** $B = \begin{bmatrix} 0.5 \cdot \Delta t^2 \\ \Delta t \end{bmatrix}$
- **Control Input ($u$):** $u = a_{Earth\_X} \cdot 9.81$
- **Process Noise Covariance ($Q$):** Tracks the inherent noise of the IMU acceleration integration.

### 5.2. Prediction Step (Every Loop)
The EKF predicts the new position and velocity based purely on kinematics:
$$X_t = F \cdot X_{t-1} + B \cdot u$$
$$P_t = F \cdot P_{t-1} \cdot F^T + Q$$

### 5.3. ZUPT Update Step (Stationary Detection)
If the raw body linear acceleration falls below a predefined noise threshold ($DEADBAND, \epsilon$), the submarine is assumed to be stationary or coasting. A pseudo-measurement ($Z$) is injected into the Kalman Filter indicating that velocity is exactly $0$.

**Measurement Matrix ($H$):** $H = \begin{bmatrix} 0 & 1 \end{bmatrix}$ (Measuring only velocity)
**Measurement ($Z$):** $Z = \begin{bmatrix} 0 \end{bmatrix}$

**Kalman Equations (Only triggered when $|a_{lin}| < \epsilon$):**
1. **Innovation:** $Y = Z - H \cdot X_t$
2. **Innovation Covariance:** $S = H \cdot P_t \cdot H^T + R$
3. **Kalman Gain:** $K = P_t \cdot H^T \cdot S^{-1}$
4. **State Correction:** $X_t = X_t + K \cdot Y$
5. **Covariance Update:** $P_t = (I - K \cdot H) \cdot P_t$

By using this Matrix-based ZUPT EKF, the velocity is statistically clamped back to zero with proper covariance propagation when the submarine halts, virtually eliminating dead reckoning drift without needing a GPS.

---

## 6. Hydrodynamic Damping (Friction)

A software-based drag coefficient is applied to the velocity state ($X[1]$) every cycle to decay velocity over time. This mimics water friction.

$$X[1] = X[1] \times 0.98$$
*(When ZUPT is active, a stronger damping of $0.85$ is applied).*

---

## 8. Appendix: Updates & Differences from Previous Models

The current mathematical model has shifted away from complex kinematic constraints (like NHC) and full Gyroscope-based 3D transformations to focus heavily on the Accelerometer data combined with a 2D Yaw correction. Here is a breakdown of the changes:

### What Changed in the Current (Yaw-Corrected Accelerometer) Model?

To simplify processing and prevent unwanted vertical tracking errors caused by Pitch and Roll transformations, we removed Pitch and Roll dependencies but retained Yaw.

1. **Independent 3-Axis Deadband added:**
   - **Formula Added:** `If |a_lin| < \epsilon \implies v \times 0.85`
   - **Why:** Instead of checking the overall magnitude vector, we now check each axis (X, Y, Z) independently. If the detected acceleration on a specific axis is below a threshold, the formula forcibly decays velocity. This stops drifting when the submarine is stopped.

2. **Removal of Pitch and Roll, Retention of Yaw:**
   - **Why:** In purely accelerometer-based systems, rotating the sensor 180 degrees and moving backwards still registers as a "forward" movement to the sensor. By using a 2D Rotation Matrix with the **Yaw** angle, the system can correctly map local movements back to the global map, ensuring that returning to the start point correctly draws the line backwards on the map. Pitch and Roll are ignored to prevent erratic tracking when the submarine tilts.

3. **Continuous Mild Damping added:**
   - **Formula Added:** `v = (v + a \times dt) \times 0.98`
   - **Why:** Even when actively accelerating, a constant $0.98$ multiplier is applied to simulate the constant drag of water, preventing the calculated velocity from blowing up to unrealistic values during continuous thrust.

# Mathematical Model for Underwater Submarine Tracking via Dead Reckoning

## Abstract

In underwater environments where GPS signals are heavily attenuated and non-functional, tracking the position of an Unmanned Underwater Vehicle (UUV) or submarine requires alternative navigational methods. This paper details the computational model implemented for tracking a submarine's 2D geographical path using Dead Reckoning (DR). The system integrates real-time heading data (via an MPU-9250 magnetometer/gyroscope array) and linear velocity (via a mechanical flow sensor) to continuously extrapolate geographical coordinates.

## 1. System Parameters and Variables

The computational model relies on the following discrete-time variables, sampled at an interval ∆t:

- v: Linear velocity of the submarine relative to the water column (m/s).
- θ: Absolute heading angle (yaw) with respect to True North (degrees), where 0° ≤ θ < 360°.
- ∆t: Time differential between the current state and the previous state (seconds).
- (x, y): Local Cartesian coordinates (meters) representing the accumulated displacement from the initial deployment origin.
- Lat_ref, Lng_ref: The reference WGS-84 origin coordinates recorded immediately before GPS signal loss.

## 2. Velocity Vector Decomposition

To calculate the positional displacement on a 2D Cartesian plane, the scalar velocity v is decomposed into orthogonal components. By standard navigational convention, the Y-axis aligns with True North (0°) and the X-axis aligns with True East (90°).

First, the heading angle θ is converted from degrees to radians:
θ_rad = θ \* (π / 180)

The velocity vector is then projected onto the Cartesian axes using trigonometric ratios:
v*x = v * sin(θ*rad)
v_y = v * cos(θ_rad)

Where v_x represents the instantaneous velocity along the East-West axis, and v_y represents the velocity along the North-South axis.

## 3. Discrete Time Integration (Euler Method)

The continuous kinematic equations of motion are approximated using a discrete first-order Euler integration. The linear displacement over the interval ∆t is computed as:
∆x = v*x * ∆t
∆y = v*y * ∆t

The accumulated Cartesian position of the submarine is iteratively updated:
x(t) = x(t-1) + ∆x
y(t) = y(t-1) + ∆y

## 4. Distance Accumulation

The total scalar distance (path length) traveled by the submarine is accumulated by computing the Euclidean magnitude of the displacement vector at each time step:
∆d = √(∆x² + ∆y²)
D_total = Σ(∆d)

## 5. Geographical Coordinate Mapping (WGS-84 Projection)

To visualize the submarine's trajectory on standard geographical maps, the local Cartesian coordinates (x, y) must be projected back into standard latitude and longitude.

Due to the spherical nature of the Earth, longitudinal distances converge at the poles. The system uses an equirectangular approximation scaled by the local latitude reference. The standard conversion constant is defined as C = 111,320 meters per degree.

The predicted latitude is derived directly from the Y-axis (North/South) displacement:
Lat_new = Lat_ref + (y / C)

The predicted longitude is derived from the X-axis (East/West) displacement, compensated by the cosine of the reference latitude to account for meridian convergence:
Lng*new = Lng_ref + (x / (C * cos(Lat*ref * π / 180)))

## 6. Conclusion

By sampling the velocity and heading at high frequencies (e.g., 10 Hz / ∆t = 0.1s) and executing this computational pipeline, the system effectively maintains continuous geographical tracking of the submarine without requiring external satellite uplinks. The accuracy of this Dead Reckoning model is primarily constrained by the mechanical precision of the flow sensor and the magnetic calibration of the MPU-9250.

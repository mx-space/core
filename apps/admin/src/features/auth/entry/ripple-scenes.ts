export type RippleScene =
  | 'login'
  | 'connect'
  | 'welcome'
  | 'account'
  | 'site'
  | 'ai-providers'
  | 'ai-models'
  | 'ai-features'
  | 'ready'

// Stretch, superellipse exponent, source spacing; angular harmonics and shear;
// contour density, aperture, extent and orientation. Values morph continuously.
export const rippleScenes: Record<RippleScene, readonly number[]> = {
  login: [1, 1.28, 2, 0, 0.006, 0.004, 0, 0, 57, 0.065, 0.48, -0.22],
  connect: [0.91, 1.65, 2, 0.13, 0.004, 0.003, 0, 0, 58, 0.005, 0.37, 0.16],
  welcome: [1.06, 1.13, 2, 0, 0.01, 0.066, 0.006, 0, 57, 0.012, 0.46, -0.35],
  account: [
    1.55, 0.98, 2, 0, 0.022, 0.014, 0.002, 0.23, 70, 0.006, 0.44, -0.32,
  ],
  site: [1.21, 1.16, 4.1, 0, 0.006, 0.004, 0.002, 0, 58, 0.03, 0.43, 0.08],
  'ai-providers': [
    1.07, 1.26, 2, 0.075, 0.02, 0.047, 0.025, -0.08, 61, 0.004, 0.43, -0.38,
  ],
  'ai-models': [
    0.94, 1.52, 3, 0.055, 0.004, 0.003, 0.005, 0, 74, 0.028, 0.43, 0,
  ],
  'ai-features': [
    1.17, 1.17, 2, 0, 0.008, 0.007, 0.065, 0, 57, 0.012, 0.47, 0.1,
  ],
  ready: [1.13, 1.13, 2, 0, 0, 0, 0, 0, 52, 0.04, 0.47, 0],
}

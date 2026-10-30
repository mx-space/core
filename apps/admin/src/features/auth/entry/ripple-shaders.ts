export const rippleVertexShader = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `

export const rippleFragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uDark;
    uniform vec4 uShape;
    uniform vec4 uWaves;
    uniform vec4 uStyle;
    uniform vec4 uCursor;
    uniform vec4 uRipples[4];
    float normShape(vec2 p, float exponent) {
      vec2 a = pow(abs(p), vec2(exponent));
      return pow(a.x + a.y, 1.0 / exponent);
    }
    mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
    void main() {
      float aspect = uResolution.x / uResolution.y;
      vec2 p = (vUv - vec2(0.5, 0.53)) * vec2(aspect, 1.0);
      vec3 blue = mix(vec3(0.13,0.35,0.90), vec3(0.12,0.44,1.0), uDark);
      vec3 color = vec3(0.0);
      float alpha = 0.0;
      float halo = exp(-dot(p * vec2(1.35,1.7), p * vec2(1.35,1.7)) * 9.0);
      halo *= mix(0.035, 0.15, uDark);
      color += blue * halo;
      alpha += halo;

        // All scenes share one continuous field. Interpolating its coefficients
        // morphs the contours themselves, including interrupted transitions.
        vec2 q = turn(uStyle.w+sin(uTime*0.13)*0.015) * p;
        q *= uShape.xy;
        q.x += q.y * uWaves.w;
        vec2 cursorDelta = p - uCursor.xy;
        float cursorDistance = length(cursorDelta);
        float attraction = exp(-dot(cursorDelta,cursorDelta)*22.0) * uCursor.z;
        q += vec2(-cursorDelta.y,cursorDelta.x) * attraction * uCursor.w * 1.5;
        float exponent = uShape.z;
        float left = normShape(q-vec2(uShape.w,0.0),exponent);
        float right = normShape(q+vec2(uShape.w,0.0),exponent);
        float smoothness = 0.12;
        float blend = clamp(0.5+0.5*(right-left)/smoothness,0.0,1.0);
        float radius = mix(right,left,blend)-smoothness*blend*(1.0-blend);
        float r = length(q);
        float a = atan(q.y,q.x);
        float wave = uWaves.x*cos(2.0*a-0.4) + uWaves.y*sin(3.0*a+sin(uTime*0.23)*0.35) + uWaves.z*cos(4.0*a+0.2);
        wave *= smoothstep(0.015,0.09,r);
        float interaction = 0.0;
        float rippleLight = 0.0;
        for(int i=0;i<4;i++) {
          float age = uTime-uRipples[i].z;
          float distanceToRipple = length(p-uRipples[i].xy);
          float envelope = exp(-age*1.25)*smoothstep(0.0,0.10,age)*(1.0-smoothstep(3.2,4.0,age));
          float front = exp(-pow((distanceToRipple-age*0.22)*20.0,2.0));
          interaction += sin(distanceToRipple*55.0-age*11.0)*front*envelope*uRipples[i].w*0.036;
          rippleLight += front*envelope*uRipples[i].w;
        }
        float field = radius + wave - attraction*0.035 + interaction;
        float density = uStyle.x;
        float rings = field*density-uTime*0.10;
        float aa = density/uResolution.y*0.85;
        float line = 1.0-smoothstep(0.045,0.045+aa,abs(fract(rings)-0.5));
        float mask = smoothstep(uStyle.y,uStyle.y+0.045,field)*(1.0-smoothstep(uStyle.z-0.07,uStyle.z,field));
        float inner = 1.0-smoothstep(uStyle.y+0.07,uStyle.y+0.22,field);
        float scan = pow(0.5+0.5*cos(a-uTime*0.25),14.0);
        vec3 ink = mix(vec3(0.43,0.40,0.36),vec3(0.68,0.70,0.76),uDark);
        vec3 lineColor = mix(ink,blue,clamp(inner+scan*0.45+attraction*0.55+rippleLight*0.4,0.0,1.0));
        float lineAlpha = line * mask * (0.20+inner*0.48+scan*0.18+attraction*0.15+rippleLight*0.13);
        color += lineColor * lineAlpha;
        alpha += lineAlpha;
        float core = exp(-dot(q,q)*11000.0)*(1.0-smoothstep(0.0,0.08,uStyle.y));
        float coreGlow = exp(-dot(q,q)*650.0)*0.07;
        color += blue*(core+coreGlow);
        alpha += core+coreGlow;
      gl_FragColor = vec4(color/max(alpha,0.001),clamp(alpha,0.0,0.92));
    }
  `

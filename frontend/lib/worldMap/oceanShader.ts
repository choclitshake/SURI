export const OCEAN_VERTEX=`
uniform float waterTime;
varying vec2 vCoastPosition;
varying vec2 vRippleUv;
varying vec3 vWaterWorld;
#include <fog_pars_vertex>
void main(){
  vCoastPosition=vec2(position.x,-position.y);
  vRippleUv=mat2(.819,.574,-.574,.819)*vCoastPosition*.105
    +vec2(sin(vCoastPosition.x*.13+vCoastPosition.y*.09),sin(vCoastPosition.x*.07-vCoastPosition.y*.17))*.075;
  vec3 p=position;
  p.z+=sin(dot(vCoastPosition,vec2(.23,.11))-waterTime*.65)*.045
    +sin(dot(vCoastPosition,vec2(-.09,.17))+waterTime*.37)*.028;
  vec4 world=modelMatrix*vec4(p,1.);
  vWaterWorld=world.xyz;
  vec4 mvPosition=viewMatrix*world;
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;

export const OCEAN_FRAGMENT=`
uniform float waterTime;
uniform sampler2D coastDepth;
uniform sampler2D waterDetail;
uniform sampler2D skyReflection;
uniform vec4 coastBounds;
uniform vec3 sunDirection;
uniform vec3 viewDirection;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform mat3 waterNormalMatrix;
varying vec2 vCoastPosition;
varying vec2 vRippleUv;
varying vec3 vWaterWorld;
#include <common>
#include <fog_pars_fragment>
void main(){
  vec2 p=vCoastPosition;
  vec2 coastUv=(p-coastBounds.xy)/coastBounds.zw;
  vec4 coast=texture2D(coastDepth,coastUv);
  float edgeDistance=min(min(coastUv.x,coastUv.y),min(1.-coastUv.x,1.-coastUv.y));
  coast.g=mix(1.,coast.g,smoothstep(-.08,.05,edgeDistance));
  coast.a=max(0.,(coast.a-.5)*2.);
  float signedShore=(coast.r-.5)*32.;
  // The visible waterline crosses the submerged skirt about half a unit
  // offshore from the dry-coast contour used by the terrain generator.
  float shore=max(0.,-signedShore-.45);
  float depth=coast.g*20.;
  // Two scrolling samples provide sub-pixel ripples without vertex rebuilds.
  vec2 flow=vec2(waterTime*.005,-waterTime*.003);
  vec2 n1=texture2D(waterDetail,fract(vRippleUv+flow)).rg*2.-1.;
  #ifdef LOW_COST_WATER
    vec2 n2=vec2(-n1.y,n1.x)*.65;
  #else
    vec2 n2=texture2D(waterDetail,fract(mat2(.36,-.933,.933,.36)*vRippleUv*1.371-flow*.73+vec2(.31,.17))).rg*2.-1.;
  #endif
  vec2 gradient=(n1+n2*.53)*.135;
  gradient*=mix(.38,1.,smoothstep(0.,3.,shore));
  vec3 normal=normalize(waterNormalMatrix*vec3(-gradient.x,gradient.y,1.));
  vec3 view=normalize(viewDirection);
  vec3 reflected=reflect(-view,normal);
  #ifdef LOW_COST_WATER
    vec2 skyUv=vec2(.5,.72)+reflected.xz*.065;
  #else
    vec2 skyUv=vec2(atan(reflected.z,reflected.x)*.15915494+.5,asin(clamp(reflected.y,-1.,1.))*.31830989+.5);
  #endif
  vec3 sky=texture2D(skyReflection,skyUv).rgb;
  float fresnel=.025+.975*pow(1.-max(dot(normal,view),0.),5.);
  vec3 water=mix(shallowColor,deepColor,1.-exp(-depth*.32));
  water*=mix(.91,1.,coast.b);
  // Suspended sand and fine caustic light disappear as the seabed deepens.
  float caustic=smoothstep(.18,.64,abs(n1.x*n1.y-n2.x*n2.y));
  water+=vec3(.028,.04,.032)*caustic*exp(-depth*.8);
  water=mix(water,sky,clamp(fresnel*.9,.025,.3));
  vec3 halfVector=normalize(sunDirection+view);
  float sparkle=pow(max(dot(normal,halfVector),0.),130.);
  float broadSpecular=pow(max(dot(normal,halfVector),0.),30.);
  water+=vec3(1.,.97,.88)*(sparkle*.42+broadSpecular*.055)*smoothstep(.1,1.5,shore);
  // Signed distance contours wrap every stack, beach and cove. Exposure and
  // baked cliff steepness vary the width; no CPU collision or ray query.
  float breaker=sin(shore*5.-waterTime*1.4+n1.x*2.+n2.y*.7);
  float width=mix(.32,.72,coast.a)*mix(.65,1.,coast.b);
  float edge=1.-smoothstep(.1,width+fwidth(shore),shore);
  float runup=(1.-smoothstep(.25,1.45,shore))*smoothstep(.6,.95,breaker)*.36;
  float broken=smoothstep(.12,.78,.45+n2.y*1.5+n1.y*.25);
  float foam=clamp(edge*.58+runup,0.,.85)*broken;
  water=mix(water,vec3(.73,.80,.77),foam);
  float mist=exp(-shore*1.2)*coast.a*.045;
  water=mix(water,vec3(.58,.70,.71),mist);
  gl_FragColor=vec4(water,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

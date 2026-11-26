// Mesh vertex calibrated on the real metal pen in the registered seated writing pose.
export const metalPenNib=[-.01090796425433985,-.0039893040020435346,-.077581765863787];

export function paperStrokeTarget(T,pen,restMatrix,sheet,size) {
 const inverse=sheet.clone().invert();
 const first=new T.Vector3(...metalPenNib).applyMatrix4(restMatrix).applyMatrix4(inverse);
 const point=new T.Vector3(...metalPenNib).applyMatrix4(pen).applyMatrix4(inverse);
 // Translate the captured stroke onto the top sheet, leaving a writing margin.
 const x=size[0]*.36, y=size[1]*.35;
 point.set(x*Math.tanh((point.x-first.x)/x),y*Math.tanh((point.y-first.y)/y),size[2]/2);
 return point.applyMatrix4(sheet);
}

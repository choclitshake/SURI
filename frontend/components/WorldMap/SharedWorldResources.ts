type Disposable={dispose:()=>void};
const resources=new Set<Disposable>();
let users=0,pending:ReturnType<typeof setTimeout>|undefined;
export function retainWorldResource<T extends Disposable>(resource:T){resources.add(resource);return resource;}
export function acquireWorldResources(){
  users++;if(pending!==undefined){clearTimeout(pending);pending=undefined;}
  return()=>{users--;if(users===0)pending=setTimeout(()=>{if(users===0)for(const resource of resources)resource.dispose();pending=undefined;},0);};
}

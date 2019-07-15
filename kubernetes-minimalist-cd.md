# Minimalist Continuous Deployment with Kubernetes

In this article we're going to talk about a way to use Kubernetes as the last leg for continuous deployment. This is not to say this is the _only_ way to go about continuous deployment with Kubernetes, it is simply a very minimalist (and therefore easy) approach to doing so.

(**tl;dr** Use one Deployment object and take advantage of its built-in features)

We'll define what we want from Kubernetes for continuous deployment as having the following behaviors upon deployment of a new version of an application:

* The old version goes away automatically.
* There is the ability to easily rollback to the old version.
* The rollout happens without downtime.

## The Application

We won't be creating any container images from scratch since there are images created by the community that will illustrate the behavior well enough:

* gcr.io/hello-minikube-zero-install/hello-node (originally from [here](https://kubernetes.io/docs/tutorials/hello-minikube/)), which will act as the "old version" of the application.
* k8s.gcr.io/echoserver:1.4 (originally from [here](https://github.com/kubernetes/minikube/blob/master/README.md)), which will act as the "new version".

The application will use a Kubernetes [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/), shown in YAML format below. Deployments have features that are essential for the behaviors we're looking for.
```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-cd-app
  labels:
    app: my-cd-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-cd-app
  template:
    metadata:
      labels:
        app: my-cd-app
    spec:
      containers:
      - name: my-cd-app
        image: gcr.io/hello-minikube-zero-install/hello-node
        ports:
        - containerPort: 8080
```
Save the Deployment as `my-cd-app.yaml`.

## The Simple Case

First, deploy the "old version":
```
$ kubectl apply -f my-cd-app.yaml
deployment "my-cd-app" created
```

Use `kubectl` to see that we now have a Deployment, a ReplicaSet (managed by the Deployment) and a Pod (managed by the ReplicaSet):
```
$ kubectl get all
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
deploy/my-cd-app   1         1         1            1           1m

NAME                      DESIRED   CURRENT   READY     AGE
rs/my-cd-app-7c5bd7694f   1         1         1         1m

NAME                            READY     STATUS    RESTARTS   AGE
po/my-cd-app-7c5bd7694f-4cdnv   1/1       Running   0          1m
```
Use port-forwarding to check that the application works (this uses the Pod name, so be sure to put whatever your Pod's name is in the command instead):
```
kubectl port-forward my-cd-app-7c5bd7694f-4cdnv 8080:8080
```
Then go to http://localhost:8080/ in your web browser and you should see: `Hello World!`

Now, terminate the port-forwarding (Ctrl-c) then open another terminal and run:
```
kubectl get pods -w
```
This will help us get a record of what happens when we deploy a new version.

Edit `my-cd-app.yaml` and replace the old `image` value with the "new version" application: `k8s.gcr.io/echoserver:1.4` Imagine this as a change that was just merged to your code repository's master branch.

Switch back to your previous terminal and deploy the new version:
```
$ kubectl apply -f my-cd-app.yaml
deployment "my-cd-app" configured
```

Now switch to the other terminal where we can see that the old Pod was terminated and the new one is now running.
```
$ kubectl get pods -w
NAME                         READY     STATUS    RESTARTS   AGE
my-cd-app-7c5bd7694f-4cdnv   1/1       Running   0          18m
my-cd-app-6d5bf8d76-2g7kh   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-2g7kh   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-2g7kh   0/1       ContainerCreating   0         0s
my-cd-app-6d5bf8d76-2g7kh   1/1       Running   0         3s
my-cd-app-7c5bd7694f-4cdnv   1/1       Terminating   0         18m
```

Enable port-forwarding again (be sure to change the Pod name) and reload your web browser. You'll see this "new version" doesn't display `Hello World!` at all and instead displays some details about the request you just made:
```
CLIENT VALUES:
client_address=127.0.0.1
command=GET
real path=/
query=nil
request_version=1.1
request_uri=http://localhost:8080/

SERVER VALUES:
server_version=nginx: 1.10.0 - lua: 10001

HEADERS RECEIVED:
accept=text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
accept-encoding=gzip, deflate
accept-language=en-CA,en-US;q=0.7,en;q=0.3
cache-control=max-age=0
connection=keep-alive
cookie=G_ENABLED_IDPS=google
host=localhost:8080
upgrade-insecure-requests=1
user-agent=Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:67.0) Gecko/20100101 Firefox/67.0
BODY:
-no body in request-
```

The details of the output aren't important. What matters is that we were able to update to a new container image, do `kubectl apply` and the Deployment handled the rest; the new version appeared and the old version went away, automatically.

## Rolling Back

Run `kubectl get all` again:
```
$ kubectl get all
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
deploy/my-cd-app   1         1         1            1           23m

NAME                      DESIRED   CURRENT   READY     AGE
rs/my-cd-app-6d5bf8d76    1         1         1         5m
rs/my-cd-app-7c5bd7694f   0         0         0         23m

NAME                           READY     STATUS    RESTARTS   AGE
po/my-cd-app-6d5bf8d76-2g7kh   1/1       Running   0          5m
```
You can see that there is more than one ReplicaSet now. By default, Deployments keep a [history](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#clean-up-policy) of ReplicaSets. The older ReplicaSet has the Pod details (including the image definition) for the old version of the application, and this is what we can roll back to.

Run `kubectl get pods -w` in a terminal again so we can see what happens on rollback.

Run the rollback:
```
$ kubectl rollout undo deploy/my-cd-app
deployment "my-cd-app"
```

Now check the other terminal to see what happened:
```
$ kubectl get pods -w
NAME                        READY     STATUS    RESTARTS   AGE
my-cd-app-6d5bf8d76-2g7kh   1/1       Running   0          35m
my-cd-app-7c5bd7694f-bqn99   0/1       Pending   0         0s
my-cd-app-7c5bd7694f-bqn99   0/1       Pending   0         0s
my-cd-app-7c5bd7694f-bqn99   0/1       ContainerCreating   0         0s
my-cd-app-7c5bd7694f-bqn99   1/1       Running   0         2s
my-cd-app-6d5bf8d76-2g7kh   1/1       Terminating   0         35m
```
As before, the existing Pod (new version) was terminated and a new Pod (old version) was created. You can use the port-forwarding to check that the result in your web browser is once again `Hello World!`.

Running `kubectl get all` again shows that the "new" ReplicaSet no longer has any Pods and the "old" one once again does.

This is another feature that comes standard with Deployments. This is only the most basic case, refer to the [Deployments documentation](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) for many more options.

## Downtime

Kubernetes Deployments by default perform a rolling update which avoids downtime, another great feature we get for free. We could just stop here, but as an example of the configurability of Deployments, we're going to modify this process slightly to aim for all new Pods being up before old ones are terminated.

Before proceeding, delete the Deployment from Kubernetes so we can start fresh:
```
$ kubectl delete deployment my-cd-app
deployment "my-cd-app" deleted
```

Here's the updated version of `my-cd-app.yaml` that we're going to use:
```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-cd-app
  labels:
    app: my-cd-app
spec:
  strategy: 
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 100%
  minReadySeconds: 10
  replicas: 3
  selector:
    matchLabels:
      app: my-cd-app
  template:
    metadata:
      labels:
        app: my-cd-app
    spec:
      containers:
      - name: my-cd-app
        image: gcr.io/hello-minikube-zero-install/hello-node
        ports:
        - containerPort: 8080
```
Here's what's changed:

* Before there was only 1 replica, but most real cases would have more, so now there's 3.
* The Deployment has a customized [RollingUpdate strategy](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment):
  * `maxUnavailable: 0` means that we don't want any of the old Pods to go away until there are new ones that are available.
  * `maxSurge: 100%` means that all the new Pods can be brought up even while all of the old Pods are still running (for a max total of 6 Pods).
* `minReadySeconds: 10` means that the new Pods won't be considered available until they've been [ready](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes) for 10 seconds. For this period of time traffic will go to both versions.

Save the new YAML contents and deploy the application again:
```
kubectl apply -f my-cd-app.yaml
```

Additionally because we have multiple pods we'll want to create a Kubernetes [Service](https://kubernetes.io/docs/concepts/services-networking/service/), which will route traffic to the Pods only when they're [ready](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes) (i.e. not in the process of starting or stopping):
```
kubectl expose deployment my-cd-app --type=NodePort --port=8080
```
We've used a NodePort here, but use whatever's appropriate for your case. Make sure you can access the application if you want to check the results in your web browser again.

Run `kubectl get pods -w` in a terminal so we can see what happens upon deployment of the new version.

Edit `my-cd-app.yaml` once again and replace the old `image` value with the "new version" application: `k8s.gcr.io/echoserver:1.4` Then redeploy: `kubectl apply -f my-cd-app.yaml`

Check the other terminal to see what happened:
```
$ kubectl get pods -w
NAME                         READY     STATUS    RESTARTS   AGE
my-cd-app-7c5bd7694f-bhx2k   1/1       Running   0          1h
my-cd-app-7c5bd7694f-c4lk5   1/1       Running   0          1h
my-cd-app-7c5bd7694f-rg7hx   1/1       Running   0          1h
my-cd-app-6d5bf8d76-9b4ls   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-9b4ls   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-89bwq   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-st5ks   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-st5ks   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-89bwq   0/1       Pending   0         0s
my-cd-app-6d5bf8d76-9b4ls   0/1       ContainerCreating   0         0s
my-cd-app-6d5bf8d76-st5ks   0/1       ContainerCreating   0         0s
my-cd-app-6d5bf8d76-89bwq   0/1       ContainerCreating   0         0s
my-cd-app-6d5bf8d76-9b4ls   1/1       Running   0         3s
my-cd-app-6d5bf8d76-st5ks   1/1       Running   0         3s
my-cd-app-6d5bf8d76-89bwq   1/1       Running   0         4s
my-cd-app-7c5bd7694f-c4lk5   1/1       Terminating   0         1h
my-cd-app-7c5bd7694f-rg7hx   1/1       Terminating   0         1h
my-cd-app-7c5bd7694f-bhx2k   1/1       Terminating   0         1h
```
As before, the old version went away and the new one came up. Additionally, because of our configuration, none of the old Pods terminated before the new Pods were running. This behavior is what will occur so long as there isn't resource contention in Kubernetes, in which case a rolling (only some Pods at a time) update will occur instead.

## What's Next?

You'll likely want to do further application-specific configuration such as [container probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes) or [lifecycle hooks](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/). These can be helpful in making sure your application accurately reports when it's live/ready, which is important during startup and can also be important during shutdown (connection draining, etc.).

In this approach, the two versions coexist for only a short period of time. Canarying of new features can be managed at the application level by using things like multiple code paths and feature toggles.

If your application's needs aren't too complex, this may work for you if you're aiming for continuous deployment to Kubernetes. What's great about this minimalist approach is that it's easy and only requires out-of-the-box Kubernetes functionality.
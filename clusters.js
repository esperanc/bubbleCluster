//
// Encapsulates an object that can be manipulated
//
class ClusterElement {

    // By default, a circle object
    constructor (center, radius, dilation) {
        this.center = center;
        this.radius = radius;
        this.dilation = dilation || 10;
        this.set_field (dilation);
        this.dirty = true; // Tells if the field associated with the element has changed
    }

    // Alter the field generated by this element by choosing another dilation
    set_field (dilation) {
        if (dilation != this.dilation) this.dirty = true;
        this.dilation = dilation;
        this.field = radial (this.center.x, this.center.y, this.radius, this.radius+this.dilation);
    }

    // Returns a bounding box for the element
    bbox () {
        var sz = this.radius + this.dilation;
        return new Bbox (this.center.x - sz, this.center.y - sz, sz*2, sz*2);
    }


    // True if element contains point p
    contains (p) {
        return distPoints (this.center, p) <= this.radius;
    }

    // Draw the object
    draw() {
        ellipse (this.center.x, this.center.y, this.radius*2, this.radius*2);
    }


    // returns the distance between this element and another element
    distance (other) {
        if (other instanceof ClusterElement)
            return Math.max(distPoints (this.center, other.center)-this.radius-other.radius,0);
        return other.distance(this);
    }

    // returns the distance between this element and a point
    distancePoint (p) {
        return Math.max(distPoints (this.center, p)-this.radius,0);
    }

    // applies translation given by vector v to this element
    translate (v) {
        this.center.x += v.x;
        this.center.y += v.y;
        this.dirty = true;
    }
}

// A line segment element
class ClusterConnector {
  
    // Constructor from two elements
    constructor (elem1, elem2, radius, dilation) {
        this.elem1 = elem1;
        this.elem2 = elem2;
        this.radius = radius;
        this.dilation = dilation || 10;
        this.set_field (dilation);
        this.dirty = true; // Tells if the field associated with the element has changed
    }
  
    // Alter the field generated by this element by choosing another dilation
    set_field (dilation) {
        if (dilation != this.dilation) this.dirty = true;
        this.dilation = dilation;
        var kernel = radial_kernel (this.radius, this.radius+this.dilation);
        this.field = function (x,y) {
            var r = distPointLineSegment (this.elem1.center, this.elem2.center, makeVector (x,y));
            return kernel (r);
        }
    }
  
    // Returns a bounding box for the element
    bbox () {
        var sz = this.radius + this.dilation;
        return (new Bbox (this.elem1.center.x - sz, this.elem1.center.y - sz, sz*2, sz*2))
               .union(new Bbox (this.elem2.center.x - sz, this.elem2.center.y - sz, sz*2, sz*2)) ;
    }


    // True if element contains point p
    contains (p) {
        var r = distPointLineSegment (this.elem1.center, this.elem2.center, p);
        return r <= this.radius;
    }

    // Draw the object
    draw() {
        line (this.elem1.center.x, this.elem1.center.y, this.elem2.center.x, this.elem2.center.y);
    }


    // returns the distance between this connector and another element
    distance (other) {
        if (other instanceof ClusterElement)
            return Math.max(distPointLineSegment (this.elem1.center, this.elem2.center, other.center) - this.radius - other.radius, 0);
        if (other instanceof ClusterConnector)
            return Math.max(
                Math.min(distPointLineSegment (this.elem1.center, this.elem2.center, other.elem1.center),
                         distPointLineSegment (this.elem1.center, this.elem2.center, other.elem2.center),
                         distPointLineSegment (other.elem1.center, other.elem2.center, this.elem1.center),
                         distPointLineSegment (other.elem1.center, other.elem2.center, this.elem2.center)) - this.radius - other.radius, 0);
        return other.distance(this);
    }

    // returns the distance between this element and a point
    distancePoint (p) {
        return Math.max(distPointLineSegment (this.elem1.center, this.elem2.center, p)-this.radius,0);
    }

    // returns true if this segment crosses segment a-b
    crosses (a,b) {
        return lineSegmentsIntersect2D(this.elem1.center,this.elem2.center,a,b);
    }

    // applies translation given by vector v to this element
    translate (v) {
        // No modification necessary since position is given by other elements
        this.dirty = true;
    }
}

// A group of elements or clusters
class Cluster extends Array {

    constructor () {
        super ();
        this.outline = [];
        this.dirty = false;
    }

    // Alter the field generated by this cluster by choosing dilation
    set_field (dilation) {
        this.dirty = false;
        for (let x of this) {
            x.set_field (dilation);
            this.dirty = this.dirty || x.dirty;
        }
        var self = this;
        this.field = function (x,y) {
            var s = 0.0;
            for (let e of self) {
                s += e.field (x,y);
            }
            return s;
        }
    }

    // Returns a bounding box for the cluster
    bbox () {
        if (this.length == 0) return null;
        var box = this[0].bbox();
        for (var i = 1; i < this.length; i++)
            box = box.union(this[i].bbox());
        return box;
    }

    // True if cluster contains point p
    contains (p) {
        for (let e of this) {
            if (e.contains (p)) return true;
        }
        return false;
    }

    // Returns a set of common elements between this cluster and other cluster
    common (other) {
        var otherset = new Set(other);
        var result = new Set();
        for (let e of this) {
            if (otherset.has(e)) result.add(e);
        }
        return result;
    }

    // Draw the cluster
    draw() {
        for (let x of this) x.draw();
    }

    // returns the distance between this cluster and another cluster/element
    distance (other) {
        var mind = 1e10; // A Big number
        for (let x of this) {
            var d = other.distance (x);
            mind = Math.min (mind, d);
        }
        return mind;
    }

    // returns the distance between this cluster and a point
    distancePoint (p) {
        var mind = 1e10; // A Big number
        for (let x of this) {
            var d = x.distancePoint(p);
            mind = Math.min (mind, d);
        }
        return mind;
    }


    // Removes an element e from this cluster if it exists. 
    // Returns true if element was removed
    remove (e) {
        for (var i = 0; i < this.length; i++) {
            if (e == this [i]) {
                this.splice (i, 1);
                return true;
            }
        }
        return false;
    } 

    // Returns a flat list of all elements of this cluster, including
    // those which are descendents of child clusters
    elements () {
        var result = [];
        for (let c of this) {
            if  (c instanceof Cluster) {
                for (let e of c.elements()) {
                    result.push(e);
                }
            }
            else if (c instanceof ClusterElement) {
                result.push (c);
            }
        }
        return result;
    }

    // Returns a flat list of all connectors of this cluster, including
    // those which are descendents of child clusters
    connectors () {
        var result = [];
        for (let c of this) {
            if  (c instanceof Cluster) {
                for (let e of c.connectors()) {
                    result.push(e);
                }
            }
            else if (c instanceof ClusterConnector) {
                result.push (c);
            }
        }
        return result;
    }

    // Return the closest element of this cluster to point p
    closestElement (p) {
        var closest = null;
        var mind = 1e10;
        for (let e of this.elements()) {
            var d = e.distancePoint (p);
            if (d < mind) {
                closest = e;
                mind = d;
            }
        }
        return closest;
    }

    // applies translation given by vector v to this cluster
    translate (v) {
        for (let e of this) e.translate(v);
        for (let o of this.outline) o.translate(v);
        this.dirty = true;
    }
}

// Provides functionality for considering some pairs of elements as belonging
// to the same cluster
class ClusterExclusion {

    // Provides pair exclusion testing for elements of cluster
    // that are on opposite sides of line pq. Only considers 
    // elements within a radius distance of pq.
    constructor (cluster, p, q, radius) {
        radius = radius || 10;
        this.aset = new Set();
        this.bset = new Set();
        for (let e of cluster.elements()) {
            if (distPointLineSegment (p,q,e.center) <= radius) {
                if (orientation2D (p,q,e.center) < 0) {
                    this.aset.add (e);
                }
                else {
                    this.bset.add (e);
                }
            }
        } 
    }

    // returns the total number of excluded pairs
    count () {
        return this.aset.size * this.bset.size;
    }

    // returns a function of the form exclusion(a,b) that yields 
    // true if element pair a,b is an excluded pair
    exclusion () {
        var self = this;
        return function (a, b) {
            if (a instanceof ClusterElement && b instanceof ClusterElement) {
                if (self.aset.has(a)) return self.bset.has(b);
                return self.bset.has(a) && self.aset.has(b);
            } else if (a instanceof Cluster && b instanceof Cluster) {
                var ina = false;
                var inb = false;
                for (let aelement of a.elements()) {
                    if (self.aset.has (aelement)) ina = true;
                    if (self.bset.has (aelement)) inb = true;
                } 
                for (let belement of b.elements()) {
                    if (self.aset.has (belement)) { if (inb) return true; }
                    if (self.bset.has (belement)) { if (ina) return true; }
                }
                return false;
            }
            console.assert (a instanceof ClusterConnector || b instanceof ClusterConnector);
        }
    }
}

//
// Reclusters an array of clusters based on distance according to the
// algorithm in the bubble cluster paper. clusters is the original
// clustering and mindist and maxdist correspond to the "small value" and
// "large value" in the paper. If exclusion is provided, it should be a function
// of the form exclusion(a,b) that returns true if element pair a,b is not
// to be merged. Returns the new reclustered array
//
function recluster (clusters, mindist, maxdist, exclusion) {
    exclusion = exclusion || function (a,b) { return false };
    var objects = [];
    var oldgroup = [], newgroup = [];
    var oldsets = [];
    var i = 0, j = 0;
    for (let c of clusters) {
        for (let e of c) {
            objects [j] = e;
            oldgroup [j] = i;
            newgroup [j] = j;
            j++;
        }
        oldsets [i] = new Set(c); 
        i++;
    }
    for (i = 0; i < objects.length; i++) {
        for (j = i+1; j < objects.length; j++) {
            var threshold = oldgroup[i]==oldgroup[j] ? maxdist : mindist;
            if (newgroup[i] != newgroup[j] && objects[i].distance(objects[j]) <= threshold && 
                !exclusion (objects[i], objects[j])) {
                // Merge class i with class j
                src = newgroup[j];
                dst = newgroup[i];
                for (var k = 0; k < objects.length; k++) {
                    if (newgroup[k] == src) newgroup [k] = dst;
                }
            }
        }
    }
    var s = new Set();
    var newclusters = [];
    var total = 0;
    for (i = 0; i < newgroup.length; i++) {
        var g = newgroup[i];
        if (! s.has(g)) {
            s.add(g);
            var c = new Cluster();
            var oldset = oldsets [oldgroup[i]];
            var samegroup = true;
            for (j = i; j < objects.length; j++) {
                if (newgroup[j] == g) {
                    c.push (objects[j]);
                }
                if (!oldset.has(objects[j])) samegroup = false;
            }
            newclusters.push (c);
            var oldc = clusters[oldgroup[i]];
            if (samegroup && oldc.length == c.length && oldc.dirty == false) {
                c.dirty = false;
                c.cache = oldc.cache;
                total += 1;
            }
        }
    }
    return newclusters;
}

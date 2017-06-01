var curveAutoClose = true;
var curveAutoCloseDelta = 5;

// creates a new curve
function Curve () {
    this.pts = [];
    this.closed = false;
}

Curve.prototype = {

    // Appends point p to the curve
    add : function (p) {
        this.pts.push(p);
        if (curveAutoClose && this.pts.length > 1) {
            this.closed = distPoints (p, this.pts[0]) <= curveAutoCloseDelta;  
        } 
    },

    // Applies function f to each point
    forEach : function (f) {
        this.pts.forEach(f);
    },

    // Reverses the order of the points in the curve
    reverse: function () {
        this.pts.reverse();
    },

    // Returns the number of points in the curve
    count: function () {
        return this.pts.length;
    },

    // Returns a deep copy of this curve
    clone : function () {
        var copy = new Curve();
        this.pts.forEach (function (p) {
            copy.pts.push (clonePoint(p));
        });
        return copy;
    },

    // Draws the curve. If close, draws a last segment between the first
    // and the last point.
    draw : function(close) {
        close = close == undefined ? this.closed : close;
        beginShape();
        this.pts.forEach(function(p) {
            vertex(p.x,p.y);
        });
        endShape(close ? CLOSE : undefined);
    },

    // Draws the points using ellipses of diameter d (8 by default)
    drawPoints : function (d) {
        d = d || 8;
        this.pts.forEach(function(p) {
            ellipse(p.x,p.y,d,d);
        });
    },

    // Returns the perimeter of the curve. If array per is passed, per[i] will contain the
    // partial perimeter at point i
    perimeter: function (per) {
        var q = this.pts[0];
        var r = 0;
        per = per || [];
        per [0] = 0;
        for (var i = 1; i < this.pts.length; i++) {
            var p = this.pts[i];
            r += distPoints(p,q);
            per [i] = r;
            q = p;
        }
        return r;
    },

    // Assuming the curve is closed and 2D, returns the area enclosed by the curve
    area: function () {
        var s = 0.0;
        for (var i = 0; i < this.pts.length; i++) {
            var j = (i+1)%this.pts.length;
            s += this.pts[i].x * this.pts[j].y;
            s -= this.pts[i].y * this.pts[j].x;
        }
        return s;
    },

    // Returns an array with the min and max corner of the minimum bounding box
    bbox: function () {
        if (this.npts.length == 0) return null;
        var min = clonePoint(this.npts[0]);
        var max = clonePoint(min);
        for (let p in this.npts) {
            if (p.x < min.x) { min.x = p.x } else if (p.x > max.x) { max.x = p.x };
            if (p.y < min.y) { min.y = p.y } else if (p.y > max.y) { max.y = p.y };
            if (p.z < min.z) { min.z = p.z } else if (p.z > max.z) { max.z = p.z };
        }
        return [min, max];
    },

    // Returns the centroid of the curve
    centroid: function () {
        var sum = makePoint(0,0,0);
        for (var i = 0; i < this.pts.length; i++) {
            var p = this.pts[i];
            sum.x += p.x;
            sum.y += p.y;
            sum.z += p.z;
        }
        sum.x /= this.pts.length;
        sum.y /= this.pts.length;
        sum.z /= this.pts.length;
        return sum;
    },

    // Returns another curve resampled by arc length with n points 
    resample: function (n) {
        var per = [];
        var len = this.perimeter(per);
        var dlen = len / (n-1);
        var p = this.pts[0];
        var r = new Curve();
        r.add ( makePoint ( p.x, p.y, p.z ));
        var j = 0;
        for (var i = 1; i < n; i++) {
            var d = dlen*i;
            while (j+1 < this.pts.length-1 && per[j+1]<d) j++;
            r.add(interpPoints (this.pts[j], this.pts[j+1], per[j], per[j+1], d));
        }
        return r;
    },

    // Returns a copy of this curve with n additional points. These are inserted
    // along the longest edges of the curve
    insert : function (n) {
        var per = [];
        var len = this.perimeter(per);
        var m = this.pts.length;
        var score = function (item) {
            return -(item.len / (item.insertions+1));
        }
        var heap = new BinaryHeap (score);
        for (var i = 1; i < m; i++) {
            heap.push ({index:i, len:(per[i]-per[i-1]), insertions: 0});
        }
        for (var i = 0; i < n; i++) {
            var item = heap.pop();
            item.insertions++;
            heap.push(item);
        }
        heap.content.sort (function (a,b) { return a.index - b.index });
        var newCurve = new Curve(), j = 0;
        for (var i = 0; i < heap.content.length; i++) {
            var item = heap.content[i];
            while (j < item.index) {
                newCurve.add (clonePoint(this.pts[j++]));
            }
            if (item.insertions>0) {
                var p = this.pts[item.index-1];
                var q = this.pts[item.index];
                for (var k = 0; k < item.insertions; k++) {
                    newCurve.add (interpPoints (p,q,0,1,(k+1)/(item.insertions+1)));
                }
            }
        }
        newCurve.add (clonePoint(this.pts[m-1]));
        return newCurve;
    },

    // Returns a adaptively resampled copy of this curve with exactly n points.
    // Uses Douglas-Peucker for subsampling and point insertion for supersampling
    adaptiveResample : function (n) {
        if (n == this.pts.length) return this.clone();
        if (n < this.pts.length) {
            // Subsample
            var dpr = douglasPeuckerRank (this.pts);
            
            var r = new Curve();
            for (var i = 0; i < this.pts.length; i++) {
                if (dpr[i] != undefined && dpr[i] < n) {
                    r.add(clonePoint(this.pts[i]))
                }
            }
            return r;
        }
        // Supersample
        return this.insert (n-this.pts.length);
    },

    // Returns the distance from point p to this curve
    distPoint : function (p) {
        var dmin = 1e100;
        for (var i = 1; i < this.pts.length; i++) {
            dmin = Math.min (dmin, distPointLineSegment (this.pts[i-1], this.pts[i], p));
        }
        return dmin;
    },

    // Assuming the curve is closed and 2D (i.e., represents a polygon), 
    // returns true iff point p is inside the polygon
    insidePoint : function (p) {
        var n = this.pts.length;
        if (n<3) return false;
        var qprev = this.pts[n-1];
        var inf = 1.0e20;
        var right = inf, nright = 0;
        var left = -inf, nleft = 0;
        for (let q of this.pts) {
            if ((qprev.y < p.y) != (q.y < p.y)) {
                var x =  qprev.x + (q.x - qprev.x) * (p.y - qprev.y) / (q.y - qprev.y) - p.x;
                if (x < 0) {
                    nleft++;
                    if (x > left) left = x;
                }
                else {
                    nright++;
                    if (x < right) right = x;
                }
            }
            qprev = q;
        }
        console.assert ((nright+nleft)%2 == 0);
        return (nright%2 != 0);
    },

    // Translates the curve by v (a vector)
    translate : function (v) {
        this.pts.forEach (function (p) {
            p.x += v.x;
            p.y += v.y;
            p.z += v.z;
        })
    },

    // Scales the curve by v (a vector)
    scale : function (v) {
        this.pts.forEach (function (p) {
            p.x *= v.x;
            p.y *= v.y;
            p.z *= v.z;
        })
    }
};

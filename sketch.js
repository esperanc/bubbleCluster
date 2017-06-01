
// Returns a radial kernel function for r0 and r1 as described
// in the bubble cluster paper...
//
function radial_kernel (r0,r1) {
    var a = r1-r0;
    var f = 1.0 / (a*a);
    var b = r0;
    return function (d) {
        var r = d-a-b;
        if (r > 0) return 0.0;
        return f * r * r;
    }
}

// 
// Returns a radial function as described in the bubble cluster
// paper...
//
function radial (x0,y0,r0,r1) {
    var k = radial_kernel (r0, r1);
    var a = r1-r0;
    var f = 1.0 / (a*a);
    var b = r0;
    var r1sqr = r1*r1;
    return function (x,y) {
        x -= x0;
        y -= y0; 
        var d2 = x*x+y*y;
        if (d2 > r1sqr) return 0.0;
        var r = Math.sqrt(d2) - a - b;
        //if (r > 0) return 0.0;
        return f * r * r;
    }
}


//
// A matrix of floats used to cache samples obtained
// with GridSample's addSample method
//
class SampleCache {
    constructor (imin,imax,jmin,jmax) {
        this.imin = imin;
        this.imax = imax;
        this.jmin = jmin;
        this.jmax = jmax;
        var n = imax-imin;
        this.m = [];
        for (var i = 0; i < n; i++) this.m[i] = [];
    }
    
    setvalue (i,j,v) {
        this.m[i-this.imin][j-this.jmin] = v;
    }

    getvalue (i,j) {
        return this.m[i-this.imin][j-this.jmin];
    }

}

//
// Represents a grid sampling of some field
//
class GridSample {

    // Initializes for a given 2D range and cell size
    constructor (xmin,xmax,ymin,ymax,cellsize) {
        this.xmin = xmin;
        this.xmax = xmax;
        this.ymin = ymin;
        this.ymax = ymax;
        this.nx = ~~((xmax-xmin)/cellsize)+1;
        this.dx = (xmax-xmin) / this.nx;
        this.ny = ~~((ymax-ymin)/cellsize)+1;
        this.dy = (ymax-ymin) / this.ny;
        this.s = [];
        for (var i = 0; i < this.ny; i++) {
            var row = [];
            for (var j = 0; j < this.nx; j++) {
                row[j] = 0;
            }
            this.s[i] = row;
        }
    }

    // Samples a field at the given 2D range and adds it to the grid
    // cells multiplied by the given scale factor. Returns a SampleCache
    // object that can then be reused with the addCache method
    addField (field, scale, xmin, xmax, ymin, ymax) {
        var imin = Math.max (~~((ymin - this.ymin) / this.dy), 0);
        var imax = Math.min (~~((ymax - this.ymin) / this.dy)+1, this.ny);
        var jmin = Math.max (~~((xmin - this.xmin) / this.dx), 0);
        var jmax = Math.min (~~((xmax - this.xmin) / this.dx)+1, this.nx);
        var cache = new SampleCache(imin,imax,jmin,jmax);
        for (var i = imin; i < imax; i++) {
            var y = this.ymin + i * this.dy;
            for (var j = jmin; j < jmax; j++) {
                var x = this.xmin + j * this.dx;
                var v = field (x,y);
                cache.setvalue (i,j,v)
                this.s[i][j] += scale * v;
            }
        }
        return cache;
    }

    // Adds the values in the given cache to the sample grid multiplied by scale
    addCache (cache, scale) {
        for (var i = cache.imin; i < cache.imax; i++) {
            for (var j = cache.jmin; j < cache.jmax; j++) {
                this.s[i][j] += scale * cache.getvalue(i,j);
            }
        }
    }

    // Returns an array of curves representing the contours for the given level
    // for the given rectangular region of the space
    polygonize (level, xmin, xmax, ymin, ymax)   {
        var imin = Math.max (~~((ymin - this.ymin) / this.dy)-1, 0);
        var imax = Math.min (~~((ymax - this.ymin) / this.dy)+2, this.ny);
        var jmin = Math.max (~~((xmin - this.xmin) / this.dx)-1, 0);
        var jmax = Math.min (~~((xmax - this.xmin) / this.dx)+2, this.nx);
        var curves = marching_squares (this.s, level, imin, imax-imin, jmin, jmax-jmin);
        for (let c of curves) {
            for (let p of c.pts) {
                p.x = p.x * this.dx + this.xmin;
                p.y = p.y * this.dy + this.ymin;
            }
        }
        return curves;
    }
}



var clusters; // Collection of Clusters
var level = 0; // Current clusterization level
var maxlevel = 5; // Maximum number of clusterization levels
var levelConnectors = [new Set(), new Set(), new Set(), new Set(), new Set()]; // Collections of connectors per level
var exclusion = null; // A function to exclude the clustering of some element pairs
var sel = null; // Selected (dragging) cluster / element if any
var grid = null;  // The current sampling of the scalar field

// Geometric constants related to the bubble cluster algorithm
var dilation_base = 10;
var dilation_increment = 10;
var dilation_radius = dilation_base;
var grid_spacing = 6.0;
var level_offset = 0.2;


// 
// Creates a higher level aggregation from an array of clusters, i.e.,
// creates an array of clusters containing one cluster each
//
function upLevel (clusters) {
    var newclusters = [];
    for (let c of clusters) {
        var newc = new Cluster();
        newc.push (c);
        newclusters.push (newc);
    }
    return newclusters;
}

// 
// Creates a lower level aggregation from an array of clusters by
// removing the contents of clusters and putting them in the result array
//
function downLevel (clusters) {
    var newclusters = [];
    for (let c of clusters) {
        for (let e of c) {
            if (e instanceof Cluster) {
                newclusters.push (e)
            }
            else {
                var newc = new Cluster();
                newc.push (e);
                newclusters.push (newc);
            }
        }
    }
    return newclusters;
}



// Interaction modes
var panMode = 0, dragMode = 1, drawMode = 2, mode = dragMode;

var inputLine = null; // A line segment to be drawn in drawMode

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
    sel = null;
    dragStart = makePoint (mouseX,mouseY);
    if (mode == dragMode) {
        for (let c of clusters) {
            var d = c.distancePoint (dragStart);
            if (d <= dilation_radius) {
                for (let e of c) {
                    if (e.contains (dragStart) && ! (e instanceof ClusterConnector)) {
                        sel = e; // An element was picked
                        break;
                    }
                }
                if (sel == null) sel = c; // The cluster was picked
            }
        }
        if (sel == null && level == 0) {
            var tmp = new Cluster();
            tmp.push (new ClusterElement(dragStart, 10));
            clusters.push (tmp);
        }
        clusters = recluster(clusters, dilation_radius, dilation_radius*2, exclusion);
    }
    else if (mode == drawMode) {
        inputLine = [dragStart, makePoint (mouseX, mouseY)];
    }
}

function mouseDragged() {
    var p = makePoint (mouseX,mouseY);
    if (mode == dragMode) {
        if (sel) {
            sel.translate (subVectors(p,dragStart));
            dragStart = p;
        }
        else if (level == 0 && distPoints (p, dragStart) >= 10) {
            var tmp = new Cluster();
            tmp.push (new ClusterElement(p, 10));
            clusters.push (tmp);
            dragStart = p;
        } 
        clusters = recluster(clusters, dilation_radius, dilation_radius*2, exclusion);
    }
    else if (mode == drawMode && inputLine) {
        inputLine [1] = p;
    }
}

function mouseReleased() { 
    sel = null;
    exclusion = null;
    if (inputLine) {
        if (mode == drawMode) {
            // Classify the stroke
            var first = null, last = null;
            for (let c of clusters) {
                for (let o of c.outline) {
                    if (o.insidePoint (inputLine[0])) {
                        first = c.closestElement(inputLine[0]);
                    }
                    if (o.insidePoint (inputLine[1])) {
                        last = c.closestElement(inputLine[1]);
                    }
                }
            }
            if (first != null && last != null && first != last) {
                // Stroke linking two distinct clusters
                var tmp = new Cluster();
                tmp.push (new ClusterConnector(first, last, 1));
                clusters.push (tmp);
                clusters = recluster(clusters, dilation_radius, dilation_radius*2, exclusion);
            }
            else {
                // Test whether stroke cuts a link and remove it
                var changed = false;
                for (let c of clusters) {
                    for (let e of c.connectors()) {
                        if (e.crosses (inputLine[0], inputLine[1])) {
                            c.remove (e);
                            changed = true;
                            break;
                        }
                    }
                }
                if (changed) {
                    clusters = recluster(clusters, dilation_radius, dilation_radius*2, exclusion);
                } else {
                    // Test for an exclusion stroke
                    for (let c of clusters) {
                        var ex = new ClusterExclusion (c, inputLine[0], inputLine[1], dilation_radius*4);
                        if (ex.count() > 0) {
                            console.log (ex.count())
                            exclusion = ex.exclusion();
                            clusters = recluster(clusters, dilation_radius, dilation_radius*2, exclusion);
                            break;
                        }
                    }
                }
            }
        }
        inputLine = null;
    }
}

function keyPressed() {
    if (keyCode == SHIFT) {
        mode = drawMode;
        cursor (CROSS);
    }
    if (key == "U" || key == "u") {
        exclusion = null;
        if (level+1 < maxlevel) {
            levelConnectors[level] = new Set();
            // for (let c of clusters) {
            //     for (let con of c.connectors()) {
            //         levelConnectors [level].push (con);
            //         c.remove (con);
            //     }
            // }
            clusters = upLevel (clusters);
            level += 1;
            for (let con of levelConnectors[level]) {
                var c = new Cluster();
                c.push (con);
                clusters.push(c);
            }
            dilation_radius = dilation_base + level * dilation_increment;
            clusters = recluster(clusters, dilation_radius*1.5, dilation_radius*1.5, exclusion);
        }
    }
    else if (key == "D" || key == "d") {
        exclusion = null;
        if (level > 0) {
            dilation_radius = 0.5 * dilation_radius;
            levelConnectors[level] = new Set();
            for (let c of clusters) {
                for (let con of c.connectors()) {
                    levelConnectors [level].add (con);
                    c.remove (con);
                }
            }
            clusters = downLevel (clusters);
            level -= 1;
            for (let con of levelConnectors[level]) {
                var c = new Cluster();
                c.push (con);
                clusters.push(c);
            }
            dilation_radius = dilation_base + level * dilation_increment;
            clusters = recluster(clusters, dilation_radius*1.5, dilation_radius*1.5, exclusion);
        }
    }
}

function keyReleased() {
    if (mode == drawMode) {
        cursor (ARROW);
        mode = dragMode;
    }
}


//
// Creates a set of polygons traced by applying marching squares
// on a potential field created from clusters. Each cluster
// will be extended with field 'outline' containing the outline curves
// for that cluster
//
function polygonize () {

    // First test whether we need to polygonize at all
    var needed = false;
    var neededBox = null;
    for (let cluster of clusters) {
        if (cluster.dirty || cluster.outline.length == 0) {
            if (!needed) {
                neededBox = cluster.bbox();
            }
            else {
                neededBox = neededBox.union (cluster.bbox());
            }
            needed = true;
        }
    }
    if (!needed) return;

    // Build another sampling of the scalar field
    grid = new GridSample(0,width,0,height,grid_spacing);

    for (let cluster of clusters) {
        cluster.set_field (dilation_radius*1.5);
        var box = cluster.bbox();
        if (cluster.dirty) {
            var cache = grid.addField (cluster.field, -1, box.x, box.x+box.width, box.y, box.y+box.height);
            cluster.cache = cache;
        }
        else {
            grid.addCache (cluster.cache,-1);
        }
        
    }
    for (let cluster of clusters) {
        var box = cluster.bbox();
        if (cluster.dirty || box.intersection (neededBox)) { 
            grid.addCache(cluster.cache,2);
            cluster.outline = grid.polygonize (level_offset, box.x, box.x+box.width, box.y, box.y+box.height);
            grid.addCache(cluster.cache,-2);
            cluster.dirty = false;
        }
    }
}

function setup() {
    makeVector = createVector; // Use p5's vector
    createCanvas (windowWidth, windowHeight);

    clusters = [];

    clusters = recluster(clusters, dilation_radius, dilation_radius*2);
}

function draw() {
    background(255);

    // sel might have moved to another cluster
    if (sel && sel instanceof Cluster) {
        for (let c of clusters) {
            if (c.common(sel).size > 0) {
                sel = c;
                break
            }
        }
    }

    polygonize();

    // Draw the elements
    fill (0);
    noStroke();
    clusters.forEach (function (e) {
        e.draw();
    });

    // If the elements are themselves clusters, draw their outlines
    noFill();
    stroke (0,0,255);
    for (let c of clusters) {
        for (let e of c) {
            if (e['outline'] != undefined) {
                for (let contour of e['outline']) {
                    contour.draw();
                }
            }
        }
    }

    // Draw the cluster outlines
    stroke (200,0,0);
    for (let c of clusters) {
        for (let contour of c['outline']) {
            contour.draw();
        }
    }

    // Draw the line input if any
    if (inputLine != null) {
        stroke (0);
        line (inputLine[0].x,inputLine[0].y,inputLine[1].x,inputLine[1].y);
    }

}
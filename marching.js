

//
// Encapsulates the marching squares algorithm.
// The idea is to obtain a vector representation of curves
// delimiting interesting features in m, a matrix that contains
// a sampling of a scalar field z = f(x,y), stored by rows, i.e.
// m[i][j] contains f(j,i). 
// 
// The function returns an array of curves that approximate f(x,y) = level
// 
// 
function marching_squares (m,level) {

    chains = new Set();

    var prev = [], curr = [];
    var iy = 0;
    var above = [];
    var width = m[0].length;
    var height = m.length;

    for (var ix = 0; ix < width; ix++) {
        prev[ix] = m[0][ix]; 
        above [ix] = null;
    }

    for (var iy = 1; iy < height; iy++) {
        curr [0] = m [iy][0];
        var left = null;
        for (var ix = 1; ix < width; ix++) {
            curr [ix] = m [iy][ix];
            var nw = prev[ix-1], ne = prev[ix], sw = curr[ix-1], se = curr[ix];
            var n = (nw < level) != (ne < level);
            var w = (nw < level) != (sw < level);
            var e = (ne < level) != (se < level);
            var s = (sw < level) != (se < level);
            var np = n ? makePoint (map (level, nw, ne, ix-1,ix), iy-1) : null;
            var sp = s ? makePoint (map (level, sw, se, ix-1,ix), iy) : null;
            var wp = w ? makePoint (ix-1, map (level, nw, sw, iy-1,iy)) : null;
            var ep = e ? makePoint (ix, map (level, ne, se, iy-1,iy)) : null;
            var below = null, right = null;
            if (s) {
                if (n) {
                    if (joinSegmentChain (np, sp, above[ix])) {
                        below = above[ix];
                    }
                    if (!below) {
                        below = [np, sp];
                        chains.add (below);
                    }
                }
                else if (w) {
                    if (joinSegmentChain (wp, sp, left)) {
                        below = left;
                    }
                    if (!below) {
                        below = [wp, sp];
                        chains.add (below);
                    }
                }

                else if (e) {
                    below = right = [ep,sp];
                    chains.add (right);
                }
                else {
                    console.assert (false, "Singleton South");
                }
            }
            if (e) {
                if (w) {
                    if (joinSegmentChain (wp, ep, left)) {
                        right = left;
                    }
                    if (!right) {
                        right = [wp, ep];
                        chains.add (right);
                    }
                }
                else if (n) {
                    if (joinSegmentChain (np, ep, above[ix])) {
                        right = above[ix];
                    }
                    if (!right) {
                        right = [np, ep];
                        chains.add (right);
                    }
                }
                else {
                    console.assert (s, "Singleton East");
                }
            }
            if (n) {
                if (w && !e) {
                    if (joinSegmentChain (wp,np,left)) {
                        if (left != above[ix]) {
                            var joined = joinChains (left, above[ix]);
                            if (joined) {
                                for (var i = 1; i < width; i++) {
                                    if (i != ix && above [i] == left) {
                                        above [i] = joined;
                                    }
                                }
                                if (below == left) below = joined;
                                if (right == left) right = joined;
                                chains.delete (left);
                            }
                        }
                    }
                    else if (joinSegmentChain (wp,np,above[ix])) {

                    } 
                    else {
                        var seg = [wp, np];
                        chains.add (seg);
                    }
                }
                else {
                    console.assert (s || e, "Singleton North");
                }
            }
            if (w) {
                console.assert (n || e || s, "Singleton West");
            }
            above[ix] = below;
            left = right;
        }
        prev = curr;
        curr = [];
    }

    
    var carray = [];
    for (let c of chains) {
        carray.push (c);
    }

    for (var iterations = 0, havejoined = true; havejoined; iterations++) {
        var joinCount = 0;
        for (var i = 0; i < carray.length; i++) {
            if (!carray [i]) continue;
            for (var j = i+1; j < carray.length; j++) {
                if (!carray[j]) continue;
                var joined = joinChains (carray[j], carray[i]);
                if (joined) {
                    chains.delete(carray[j]);
                    carray[j] = null;
                    joinCount++;
                }
            }
        }
        havejoined = joinCount>0;
    }

    var result = [];
    for (var i = 0; i < carray.length; i++) {
        if (!carray [i]) continue;
        var c = new Curve();
        c.pts = carray[i];
        c.closed = true;
        result.push(c);
    }
    return result;

}

// Joins a new segment a-b to chain p. Returns the modified
// chain if successful, or false otherwise
var joinSegmentChain = function (a, b, p) {
    if (!p) return false;
    var c = p[0], d = p[p.length-1];
    if (a.x == c.x && a.y == c.y) {
        p.reverse(); p.push (b); return p;
    }
    if (b.x == c.x && b.y == c.y) {
        p.reverse(); p.push (a); return p;
    }
    if (a.x == d.x && a.y == d.y) {
        p.push (b); return p;
    }
    if (b.x == d.x && b.y == d.y) {
        p.push (a); return p;
    }
    return false;
}

// Joins chain l to chain p if they have a common endpoint, returning
// the modified chain p. Otherwise, returns false
var joinChains = function (l, p) {
    if (!l) return false;
    if (!p) return false;
    console.assert (l!=p, "Can't join chain with itself");
    var a = l[0], b = l[l.length-1];
    var c = p[0], d = p[p.length-1];
    if (a.x == c.x && a.y == c.y) {
        p.reverse(); 
    }
    else if (b.x == c.x && b.y == c.y) {
        p.reverse(); l.reverse(); 
    }
    else if (a.x == d.x && a.y == d.y) {
    }
    else if (b.x == d.x && b.y == d.y) {
        l.reverse();
    }
    else {
        return false;
    }
    for (var i = 1; i < l.length; i++) {
        p.push(l[i]);
    }
    return p;
}


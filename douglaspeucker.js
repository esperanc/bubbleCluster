// Creates a Douglas Peucker Item, which
// represents a span of a polyline and the farthest element from the
// line segment connecting the first and the last element of the span.
// Poly is an array of points, first is the index of the first element of the span, 
// and last the last element.
function dpItem (first, last, poly) {
    var dist = 0;
    var farthest = first+1;
    var a = poly[first];
    var b = poly[last];

    for (var i = first+1; i < last; i++) {
        var d = distPointLineSegment (a, b, poly[i]);
        if (d > dist) {
            dist = d;
            farthest = i;
        }
    }

    return {
        first: first,
        last: last,
        farthest: farthest,
        dist : dist
    }
};

// Returns an array of ranks of vertices of a polyline according to the
// generalization order imposed by the Douglas Peucker algorithm.
// Thus, if the i'th element has value k, then vertex i would be the (k+1)'th
// element to be included in a generalization (simplification) of this polyline.
// Does not consider vertices farther than tol. Disconsidered
// vertices are left undefined in the result.
function douglasPeuckerRank (poly, tol) {

  // A priority queue of intervals to subdivide, where top priority is biggest dist
  var pq = new BinaryHeap (function (dpi) { return -dpi.dist; });

  // The result vector
  var r = [];

  // Put the first and last vertices in the result
  r [0] = 0;
  r [poly.length-1] = 1;

  // Add first interval to pq
  if (poly.length <= 2) { return r };
  pq.push (dpItem (0, poly.length-1, poly));

  // The rank counter 
  var rank = 2;

  // Recursively subdivide up to tol
  while (pq.size ()>0) {
    var item = pq.pop ();
    if (item.dist < tol) break; // All remaining points are closer 
    r [item.farthest] = rank++;
    if (item.farthest > item.first+1) {
      pq.push (dpItem (item.first, item.farthest, poly));
    }
    if (item.last > item.farthest+1) {
      pq.push (dpItem (item.farthest, item.last, poly));
    }
  }

  return r;
}        
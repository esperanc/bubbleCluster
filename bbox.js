//
// Represents a bounding box in 2D
//
class Bbox {

    // Constructor 
    constructor (x,y,width,height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // Returns a new bbox with the union of this and other
    union (other) {
        var x = Math.min (this.x, other.x);
        var y = Math.min (this.y, other.y);
        var w = Math.max (this.x + this.width, other.x + other.width) - x;
        var h = Math.max (this.y + this.height, other.y + other.height) - y;
        return new Bbox (x,y,w,h);
    }

    // Returns a new bbox with the intersection of this and other, or null
    // if no intersection exists
    intersection (other) {
        var x = Math.max (this.x, other.x);
        var y = Math.max (this.y, other.y);
        var w = Math.min (this.x + this.width, other.x + other.width) - x;
        var h = Math.min (this.y + this.height, other.y + other.height) - y;
        if (w>0 && h>0) {
            return new Bbox (x,y,w,h);
        }
        return null;
    }
}

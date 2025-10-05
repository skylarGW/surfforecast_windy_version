const UTILS = {
    formatCoordinates: function(coords) {
        return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    },
    degreeToDirection: function(degree) {
        const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        return directions[Math.round(degree / 45) % 8];
    }
};
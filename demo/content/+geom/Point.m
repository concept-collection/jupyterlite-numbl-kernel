classdef Point
    % A class that lives inside the +geom package: geom.Point(...).
    properties
        x = 0
        y = 0
    end
    methods
        function obj = Point(x, y)
            if nargin > 0, obj.x = x; obj.y = y; end
        end
        function d = dist(obj)
            d = sqrt(obj.x^2 + obj.y^2);
        end
    end
end

classdef Circle < Shape
    properties
        r = 1
    end
    methods
        function obj = Circle(r)
            if nargin > 0, obj.r = r; end
        end
        function a = area(obj)
            a = pi * obj.r^2;
        end
    end
end

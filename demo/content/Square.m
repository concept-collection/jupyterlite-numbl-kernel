classdef Square < Shape
    properties
        s = 1
    end
    methods
        function obj = Square(s)
            if nargin > 0, obj.s = s; end
        end
        function a = area(obj)
            a = obj.s^2;
        end
    end
end

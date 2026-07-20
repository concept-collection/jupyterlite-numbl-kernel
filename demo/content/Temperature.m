classdef Temperature
    properties
        celsius = 0
    end
    methods
        function obj = Temperature(c)
            if nargin > 0, obj.celsius = c; end
        end
        function f = fahrenheit(obj)
            % Uses a private helper method to do the conversion.
            f = obj.toF(obj.celsius);
        end
    end
    methods (Access = private)
        function f = toF(~, c)
            f = c * 9 / 5 + 32;
        end
    end
end

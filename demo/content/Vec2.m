classdef Vec2
    % A value class with operator overloading.
    properties
        x = 0
        y = 0
    end
    methods
        function obj = Vec2(x, y)
            if nargin > 0
                obj.x = x;
                obj.y = y;
            end
        end
        function r = plus(a, b)
            r = Vec2(a.x + b.x, a.y + b.y);
        end
        function r = minus(a, b)
            r = Vec2(a.x - b.x, a.y - b.y);
        end
        function r = mtimes(a, b)
            % Scalar multiply, with the scalar on either side.
            if isa(a, 'Vec2')
                r = Vec2(a.x * b, a.y * b);
            else
                r = Vec2(b.x * a, b.y * a);
            end
        end
        function n = norm(obj)
            n = sqrt(obj.x^2 + obj.y^2);
        end
        function s = char(obj)
            s = sprintf('(%g, %g)', obj.x, obj.y);
        end
    end
end

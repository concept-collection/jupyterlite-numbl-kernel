classdef MathX
    % Static methods are called as Class.method(...) with no instance.
    methods (Static)
        function d = hypot3(a, b, c)
            d = sqrt(a^2 + b^2 + c^2);
        end
    end
end

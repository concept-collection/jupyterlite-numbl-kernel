classdef Shape
    % Abstract base class. Subclasses must implement area().
    methods (Abstract)
        a = area(obj)
    end
    methods
        function describe(obj)
            fprintf('%s has area %.3f\n', class(obj), obj.area());
        end
    end
end

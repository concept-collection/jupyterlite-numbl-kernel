try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    import warnings

    warnings.warn("Importing 'jupyterlite_numbl_kernel' outside a proper installation.")
    __version__ = "dev"


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "jupyterlite-numbl-kernel"}]

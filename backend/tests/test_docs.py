def test_docs_route_returns_documentation(client):
    response = client.get("/docs")

    assert response.status_code == 200
    text = response.get_data(as_text=True)
    assert "IPABrew Documentation" in text
    assert "CLI" in text
    assert "/api/reconstruct_tree" in text


def test_index_returns_docs_navigation_link(client):
    response = client.get("/")

    assert response.status_code == 200
    text = response.get_data(as_text=True)
    assert 'href="/docs"' in text

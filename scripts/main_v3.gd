extends Node2D

const PuzzlePieceScene := preload("res://scripts/puzzle_piece_v3.gd")

const PUZZLE_DIR := "res://assets/puzzles"
const DEFAULT_PUZZLE := "res://assets/puzzles/test.webp"
const PRESETS: Array[int] = [12, 48, 108, 300, 768, 1200, 2000, 3000]
const CURVE_STEPS := 5
const PIECE_WORLD_WIDTH := 160.0
const MIN_INITIAL_PIECE_SCREEN := 46.0
const SNAP_SCREEN_PX := 34.0

var _rng := RandomNumberGenerator.new()
var _texture: Texture2D
var _puzzle_path: String = ""
var _image_size: Vector2 = Vector2.ZERO

var _columns: int = 4
var _rows: int = 3
var _piece_count: int = 12
var _locked_count: int = 0

var _world: Node2D
var _camera: Camera2D
var _pieces: Array[PuzzlePieceV3] = []
var _active_piece: PuzzlePieceV3
var _panning: bool = false
var _display_scale: float = 1.0
var _cell_display_size: Vector2 = Vector2.ZERO
var _board_origin: Vector2 = Vector2.ZERO
var _board_size: Vector2 = Vector2.ZERO
var _workspace_rect: Rect2
var _fit_zoom: float = 1.0
var _min_zoom: float = 0.08
var _max_zoom: float = 2.5

var _background_layer: CanvasLayer
var _ui_layer: CanvasLayer
var _status_label: Label
var _zoom_label: Label


func _ready() -> void:
	_rng.randomize()
	_build_fixed_background()
	_ui_layer = CanvasLayer.new()
	_ui_layer.layer = 100
	add_child(_ui_layer)

	_puzzle_path = _find_puzzle_image()
	if _puzzle_path.is_empty():
		_show_message(
			"Нет картинки",
			"Положи изображение в res://assets/puzzles/\nПоддерживаются PNG / JPG / JPEG / WebP."
		)
		return

	_texture = load(_puzzle_path) as Texture2D
	if _texture == null:
		_show_message("Ошибка загрузки", "Не удалось загрузить:\n%s" % _puzzle_path)
		return

	_image_size = _texture.get_size()
	if _image_size.x <= 0.0 or _image_size.y <= 0.0:
		_show_message("Ошибка картинки", "У изображения некорректный размер.")
		return

	_show_mode_menu()


func _build_fixed_background() -> void:
	_background_layer = CanvasLayer.new()
	_background_layer.layer = -100
	add_child(_background_layer)

	var background := ColorRect.new()
	background.position = Vector2.ZERO
	background.size = get_viewport_rect().size
	background.color = Color(0.025, 0.035, 0.055, 1.0)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_background_layer.add_child(background)


func _find_puzzle_image() -> String:
	if ResourceLoader.exists(DEFAULT_PUZZLE):
		return DEFAULT_PUZZLE

	var dir := DirAccess.open(PUZZLE_DIR)
	if dir == null:
		return ""

	var candidates: Array[String] = []
	dir.list_dir_begin()
	var file_name: String = dir.get_next()
	while not file_name.is_empty():
		if not dir.current_is_dir():
			var extension: String = file_name.get_extension().to_lower()
			if extension in ["webp", "png", "jpg", "jpeg"]:
				candidates.append(file_name)
		file_name = dir.get_next()
	dir.list_dir_end()

	candidates.sort()
	for candidate in candidates:
		var path := "%s/%s" % [PUZZLE_DIR, candidate]
		if ResourceLoader.exists(path):
			return path
	return ""


func _show_mode_menu() -> void:
	_clear_ui()
	var screen_size: Vector2 = get_viewport_rect().size

	var title := Label.new()
	title.position = Vector2(0.0, 48.0)
	title.size = Vector2(screen_size.x, 48.0)
	title.text = "Выбери количество деталей"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 32)
	title.add_theme_color_override("font_color", Color(0.94, 0.97, 1.0, 1.0))
	_ui_layer.add_child(title)

	var subtitle := Label.new()
	subtitle.position = Vector2(0.0, 98.0)
	subtitle.size = Vector2(screen_size.x, 35.0)
	subtitle.text = "Сетка автоматически подстраивается под пропорции изображения"
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 17)
	subtitle.add_theme_color_override("font_color", Color(0.59, 0.69, 0.82, 1.0))
	_ui_layer.add_child(subtitle)

	var grid := GridContainer.new()
	grid.columns = 2
	grid.position = Vector2(screen_size.x * 0.5 - 275.0, 160.0)
	grid.add_theme_constant_override("h_separation", 16)
	grid.add_theme_constant_override("v_separation", 14)
	_ui_layer.add_child(grid)

	for target_count in PRESETS:
		var grid_size: Vector2i = _choose_grid(target_count)
		var actual_count: int = grid_size.x * grid_size.y
		var button := Button.new()
		button.custom_minimum_size = Vector2(267.0, 76.0)
		button.text = "%s%d деталей\n%d × %d" % ["~" if actual_count != target_count else "", actual_count, grid_size.x, grid_size.y]
		button.add_theme_font_size_override("font_size", 19)
		button.pressed.connect(_start_mode.bind(target_count))
		grid.add_child(button)

	var note := Label.new()
	note.position = Vector2(60.0, screen_size.y - 82.0)
	note.size = Vector2(screen_size.x - 120.0, 54.0)
	note.text = "Большие режимы создают большое игровое поле. Колесо — масштаб, ПКМ/СКМ — перемещение, F — показать весь пазл."
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_theme_font_size_override("font_size", 15)
	note.add_theme_color_override("font_color", Color(0.52, 0.64, 0.77, 1.0))
	_ui_layer.add_child(note)


func _choose_grid(target_count: int) -> Vector2i:
	var aspect: float = _image_size.x / _image_size.y
	var ideal_rows: float = sqrt(float(target_count) / aspect)
	var max_rows: int = maxi(3, int(ceil(ideal_rows * 1.7)) + 4)
	var best := Vector2i(4, 3)
	var best_score: float = INF

	for rows in range(2, max_rows + 1):
		var columns: int = maxi(2, int(round(float(rows) * aspect)))
		var count: int = rows * columns
		if count > target_count:
			continue
		var ratio: float = float(columns) / float(rows)
		var count_loss: float = float(target_count - count) / float(target_count)
		var ratio_loss: float = absf(log(ratio / aspect))
		var score: float = count_loss * 1.35 + ratio_loss * 2.8
		if score < best_score:
			best_score = score
			best = Vector2i(columns, rows)

	return best


func _start_mode(target_count: int) -> void:
	_destroy_world()
	_clear_ui()

	var grid_size: Vector2i = _choose_grid(target_count)
	_columns = grid_size.x
	_rows = grid_size.y
	_piece_count = _columns * _rows
	_locked_count = 0

	_build_world()
	_build_game_ui()
	_update_status()


func _build_world() -> void:
	_world = Node2D.new()
	_world.name = "PuzzleWorld"
	add_child(_world)

	_camera = Camera2D.new()
	_camera.name = "PuzzleCamera"
	_camera.enabled = true
	add_child(_camera)

	var cell_source_size := Vector2(
		_image_size.x / float(_columns),
		_image_size.y / float(_rows)
	)
	_display_scale = PIECE_WORLD_WIDTH / cell_source_size.x
	_cell_display_size = cell_source_size * _display_scale
	_board_origin = Vector2.ZERO
	_board_size = _image_size * _display_scale

	var padding: float = maxf(300.0, sqrt(float(_piece_count)) * PIECE_WORLD_WIDTH * 0.16)
	_workspace_rect = Rect2(_board_origin, _board_size).grow(padding)

	_build_board_preview()
	_generate_pieces(cell_source_size)
	_setup_camera()


func _build_board_preview() -> void:
	var board_panel := ColorRect.new()
	board_panel.position = _board_origin - Vector2(12.0, 12.0)
	board_panel.size = _board_size + Vector2(24.0, 24.0)
	board_panel.color = Color(0.07, 0.095, 0.14, 0.98)
	board_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	board_panel.z_index = -30
	_world.add_child(board_panel)

	var preview := Sprite2D.new()
	preview.texture = _texture
	preview.centered = false
	preview.position = _board_origin
	preview.scale = Vector2.ONE * _display_scale
	preview.modulate = Color(1.0, 1.0, 1.0, 0.13)
	preview.z_index = -20
	_world.add_child(preview)

	var border := Line2D.new()
	border.points = PackedVector2Array([
		_board_origin,
		_board_origin + Vector2(_board_size.x, 0.0),
		_board_origin + _board_size,
		_board_origin + Vector2(0.0, _board_size.y)
	])
	border.closed = true
	border.width = 2.0
	border.default_color = Color(0.34, 0.60, 0.78, 0.58)
	border.antialiased = true
	border.z_index = -10
	_world.add_child(border)


func _generate_pieces(cell_source_size: Vector2) -> void:
	_pieces.clear()
	var vertical_edges: Array = _generate_vertical_edges()
	var horizontal_edges: Array = _generate_horizontal_edges()
	var detail_level: int = 0 if _piece_count <= 300 else (1 if _piece_count <= 1500 else 2)
	var piece_id: int = 0

	for row in range(_rows):
		for column in range(_columns):
			var top_edge: Dictionary = {} if row == 0 else horizontal_edges[row - 1][column]
			var right_edge: Dictionary = {} if column == _columns - 1 else vertical_edges[row][column]
			var bottom_edge: Dictionary = {} if row == _rows - 1 else horizontal_edges[row][column]
			var left_edge: Dictionary = {} if column == 0 else vertical_edges[row][column - 1]

			var top_sign: int = 0 if row == 0 else -int(top_edge["type"])
			var right_sign: int = 0 if column == _columns - 1 else int(right_edge["type"])
			var bottom_sign: int = 0 if row == _rows - 1 else int(bottom_edge["type"])
			var left_sign: int = 0 if column == 0 else -int(left_edge["type"])

			var polygon: PackedVector2Array = _build_piece_polygon(
				cell_source_size,
				top_edge, top_sign,
				right_edge, right_sign,
				bottom_edge, bottom_sign,
				left_edge, left_sign
			)

			var source_origin := Vector2(
				column * cell_source_size.x,
				row * cell_source_size.y
			)
			var uv_points := PackedVector2Array()
			for point in polygon:
				uv_points.append(source_origin + point)

			var target: Vector2 = _board_origin + source_origin * _display_scale
			var piece := PuzzlePieceScene.new() as PuzzlePieceV3
			piece.name = "Piece_%04d" % piece_id
			_world.add_child(piece)
			piece.setup(
				_texture,
				polygon,
				uv_points,
				target,
				_display_scale,
				piece_id,
				SNAP_SCREEN_PX / maxf(_initial_zoom_for_piece_size(), 0.01),
				detail_level
			)
			piece.locked_in_place.connect(_on_piece_locked)
			piece.place_scrambled(_scatter_position(piece_id))
			_pieces.append(piece)
			piece_id += 1


func _generate_vertical_edges() -> Array:
	var result: Array = []
	for _row in range(_rows):
		var edge_row: Array = []
		for _column in range(_columns - 1):
			edge_row.append(_make_edge_descriptor())
		result.append(edge_row)
	return result


func _generate_horizontal_edges() -> Array:
	var result: Array = []
	for _row in range(_rows - 1):
		var edge_row: Array = []
		for _column in range(_columns):
			edge_row.append(_make_edge_descriptor())
		result.append(edge_row)
	return result


func _make_edge_descriptor() -> Dictionary:
	return {
		"type": 1 if _rng.randi_range(0, 1) == 0 else -1,
		"center": _rng.randf_range(0.462, 0.538),
		"neck": _rng.randf_range(0.046, 0.058),
		"head": _rng.randf_range(0.118, 0.142),
		"base": _rng.randf_range(0.188, 0.218),
		"depth": _rng.randf_range(0.155, 0.182)
	}


func _build_piece_polygon(
	cell_size: Vector2,
	top_edge: Dictionary, top_sign: int,
	right_edge: Dictionary, right_sign: int,
	bottom_edge: Dictionary, bottom_sign: int,
	left_edge: Dictionary, left_sign: int
) -> PackedVector2Array:
	var width: float = cell_size.x
	var height: float = cell_size.y
	var depth_base: float = minf(width, height)
	var points := PackedVector2Array()

	points.append_array(_sample_classic_edge(Vector2(0.0, 0.0), Vector2(width, 0.0), Vector2(0.0, -1.0), top_edge, top_sign, depth_base, false, false, false))
	points.append_array(_sample_classic_edge(Vector2(width, 0.0), Vector2(width, height), Vector2(1.0, 0.0), right_edge, right_sign, depth_base, false, true, false))
	points.append_array(_sample_classic_edge(Vector2(width, height), Vector2(0.0, height), Vector2(0.0, 1.0), bottom_edge, bottom_sign, depth_base, true, true, false))
	points.append_array(_sample_classic_edge(Vector2(0.0, height), Vector2(0.0, 0.0), Vector2(-1.0, 0.0), left_edge, left_sign, depth_base, true, true, true))
	return points


func _sample_classic_edge(
	from: Vector2,
	to: Vector2,
	outward_normal: Vector2,
	edge: Dictionary,
	sign_value: int,
	depth_base: float,
	reverse_profile: bool,
	skip_first: bool,
	skip_last: bool
) -> PackedVector2Array:
	if sign_value == 0 or edge.is_empty():
		return _straight_edge(from, to, skip_first, skip_last)

	var center: float = float(edge["center"])
	if reverse_profile:
		center = 1.0 - center
	var neck_half: float = float(edge["neck"])
	var head_half: float = float(edge["head"])
	var base_half: float = float(edge["base"])
	var depth: float = depth_base * float(edge["depth"])
	var direction: float = float(sign_value)

	var normalized := PackedVector2Array()
	normalized.append(Vector2(0.0, 0.0))
	normalized.append(Vector2(center - base_half, 0.0))
	_append_curve(normalized, Vector2(center - base_half, 0.0), Vector2(center - base_half * 0.70, 0.0), Vector2(center - neck_half * 1.25, -0.045), Vector2(center - neck_half, 0.18))
	_append_curve(normalized, Vector2(center - neck_half, 0.18), Vector2(center - neck_half * 0.95, 0.36), Vector2(center - head_half, 0.43), Vector2(center - head_half, 0.65))
	_append_curve(normalized, Vector2(center - head_half, 0.65), Vector2(center - head_half * 0.92, 0.90), Vector2(center - head_half * 0.46, 1.0), Vector2(center, 1.0))
	_append_curve(normalized, Vector2(center, 1.0), Vector2(center + head_half * 0.46, 1.0), Vector2(center + head_half * 0.92, 0.90), Vector2(center + head_half, 0.65))
	_append_curve(normalized, Vector2(center + head_half, 0.65), Vector2(center + head_half, 0.43), Vector2(center + neck_half * 0.95, 0.36), Vector2(center + neck_half, 0.18))
	_append_curve(normalized, Vector2(center + neck_half, 0.18), Vector2(center + neck_half * 1.25, -0.045), Vector2(center + base_half * 0.70, 0.0), Vector2(center + base_half, 0.0))
	normalized.append(Vector2(1.0, 0.0))

	var result := PackedVector2Array()
	for p in normalized:
		var point: Vector2 = from.lerp(to, p.x)
		point += outward_normal * p.y * depth * direction
		result.append(point)
	if skip_first and result.size() > 0:
		result.remove_at(0)
	if skip_last and result.size() > 0:
		result.remove_at(result.size() - 1)
	return result


func _append_curve(points: PackedVector2Array, p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2) -> void:
	for index in range(1, CURVE_STEPS + 1):
		var t: float = float(index) / float(CURVE_STEPS)
		points.append(_cubic_bezier(p0, p1, p2, p3, t))


func _cubic_bezier(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, t: float) -> Vector2:
	var u: float = 1.0 - t
	return (
		p0 * (u * u * u)
		+ p1 * (3.0 * u * u * t)
		+ p2 * (3.0 * u * t * t)
		+ p3 * (t * t * t)
	)


func _straight_edge(from: Vector2, to: Vector2, skip_first: bool, skip_last: bool) -> PackedVector2Array:
	var result := PackedVector2Array([from, to])
	if skip_first and result.size() > 0:
		result.remove_at(0)
	if skip_last and result.size() > 0:
		result.remove_at(result.size() - 1)
	return result


func _scatter_position(index: int) -> Vector2:
	var padding_left: float = _board_origin.x - _workspace_rect.position.x
	var padding_top: float = _board_origin.y - _workspace_rect.position.y
	var side: int = index % 4
	var jitter_x: float = _rng.randf_range(0.0, maxf(_board_size.x, 1.0))
	var jitter_y: float = _rng.randf_range(0.0, maxf(_board_size.y, 1.0))
	var x: float
	var y: float

	match side:
		0:
			x = _board_origin.x + jitter_x
			y = _rng.randf_range(_board_origin.y - padding_top + 12.0, _board_origin.y - _cell_display_size.y - 18.0)
		1:
			x = _board_origin.x + _board_size.x + _rng.randf_range(22.0, maxf(30.0, padding_left - _cell_display_size.x))
			y = _board_origin.y + jitter_y
		2:
			x = _board_origin.x + jitter_x
			y = _board_origin.y + _board_size.y + _rng.randf_range(22.0, maxf(30.0, padding_top - _cell_display_size.y))
		_:
			x = _rng.randf_range(_board_origin.x - padding_left + 12.0, _board_origin.x - _cell_display_size.x - 18.0)
			y = _board_origin.y + jitter_y

	return Vector2(x, y)


func _setup_camera() -> void:
	var screen_size: Vector2 = get_viewport_rect().size
	var usable_size := Vector2(screen_size.x * 0.92, maxf(220.0, screen_size.y - 125.0))
	_fit_zoom = minf(usable_size.x / _board_size.x, usable_size.y / _board_size.y)
	_min_zoom = maxf(0.035, minf(_fit_zoom * 0.78, 0.16))
	_max_zoom = 2.75
	var initial_zoom: float = maxf(_fit_zoom, _initial_zoom_for_piece_size())
	initial_zoom = clampf(initial_zoom, _min_zoom, 1.35)
	_camera.position = Rect2(_board_origin, _board_size).get_center()
	_set_zoom(initial_zoom)


func _initial_zoom_for_piece_size() -> float:
	return MIN_INITIAL_PIECE_SCREEN / PIECE_WORLD_WIDTH


func _build_game_ui() -> void:
	var screen_size: Vector2 = get_viewport_rect().size
	var bar := ColorRect.new()
	bar.position = Vector2.ZERO
	bar.size = Vector2(screen_size.x, 90.0)
	bar.color = Color(0.045, 0.065, 0.10, 0.97)
	bar.mouse_filter = Control.MOUSE_FILTER_STOP
	_ui_layer.add_child(bar)

	var title := Label.new()
	title.position = Vector2(24.0, 13.0)
	title.size = Vector2(520.0, 32.0)
	title.text = "ПАЗЛ • %d деталей • %d × %d" % [_piece_count, _columns, _rows]
	title.add_theme_font_size_override("font_size", 23)
	title.add_theme_color_override("font_color", Color(0.94, 0.97, 1.0, 1.0))
	bar.add_child(title)

	var hint := Label.new()
	hint.position = Vector2(25.0, 49.0)
	hint.size = Vector2(760.0, 25.0)
	hint.text = "Колесо: масштаб • ПКМ/СКМ: двигать поле • F: весь пазл • R: перемешать"
	hint.add_theme_font_size_override("font_size", 14)
	hint.add_theme_color_override("font_color", Color(0.57, 0.69, 0.83, 1.0))
	bar.add_child(hint)

	_status_label = Label.new()
	_status_label.position = Vector2(screen_size.x - 195.0, 12.0)
	_status_label.size = Vector2(165.0, 30.0)
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_status_label.add_theme_font_size_override("font_size", 21)
	_status_label.add_theme_color_override("font_color", Color(0.44, 0.88, 1.0, 1.0))
	bar.add_child(_status_label)

	_zoom_label = Label.new()
	_zoom_label.position = Vector2(screen_size.x - 195.0, 50.0)
	_zoom_label.size = Vector2(165.0, 22.0)
	_zoom_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_zoom_label.add_theme_font_size_override("font_size", 13)
	_zoom_label.add_theme_color_override("font_color", Color(0.58, 0.68, 0.80, 1.0))
	bar.add_child(_zoom_label)

	var mode_button := Button.new()
	mode_button.position = Vector2(screen_size.x - 340.0, 24.0)
	mode_button.size = Vector2(118.0, 42.0)
	mode_button.text = "Сложность"
	mode_button.pressed.connect(_back_to_modes)
	bar.add_child(mode_button)


func _unhandled_input(event: InputEvent) -> void:
	if _camera == null or _world == null:
		return

	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			_zoom_at(event.position, 1.14)
			get_viewport().set_input_as_handled()
			return
		if event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			_zoom_at(event.position, 1.0 / 1.14)
			get_viewport().set_input_as_handled()
			return

		if event.button_index == MOUSE_BUTTON_MIDDLE or event.button_index == MOUSE_BUTTON_RIGHT:
			_panning = event.pressed
			get_viewport().set_input_as_handled()
			return

		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				var world_point: Vector2 = _screen_to_world(event.position)
				_active_piece = _pick_piece(world_point)
				if _active_piece != null:
					_active_piece.begin_drag(world_point)
					_raise_piece(_active_piece)
					get_viewport().set_input_as_handled()
			else:
				if _active_piece != null:
					_active_piece.end_drag()
					_active_piece = null
					get_viewport().set_input_as_handled()
			return

	if event is InputEventMouseMotion:
		if _panning:
			_camera.position -= event.relative / maxf(_camera.zoom.x, 0.001)
			_clamp_camera_position()
			get_viewport().set_input_as_handled()
			return
		if _active_piece != null:
			_active_piece.drag_to(_screen_to_world(event.position))
			get_viewport().set_input_as_handled()
			return

	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F:
			_camera.position = Rect2(_board_origin, _board_size).get_center()
			_set_zoom(_fit_zoom)
		elif event.keycode == KEY_R:
			_reshuffle_all()
		elif event.keycode == KEY_EQUAL or event.keycode == KEY_KP_ADD:
			_set_zoom(_camera.zoom.x * 1.15)
		elif event.keycode == KEY_MINUS or event.keycode == KEY_KP_SUBTRACT:
			_set_zoom(_camera.zoom.x / 1.15)


func _pick_piece(world_point: Vector2) -> PuzzlePieceV3:
	for index in range(_pieces.size() - 1, -1, -1):
		var piece: PuzzlePieceV3 = _pieces[index]
		if piece.contains_world_point(world_point):
			return piece
	return null


func _raise_piece(piece: PuzzlePieceV3) -> void:
	var index: int = _pieces.find(piece)
	if index >= 0:
		_pieces.remove_at(index)
		_pieces.append(piece)


func _screen_to_world(screen_point: Vector2) -> Vector2:
	return get_viewport().get_canvas_transform().affine_inverse() * screen_point


func _zoom_at(screen_point: Vector2, factor: float) -> void:
	var before: Vector2 = _screen_to_world(screen_point)
	_set_zoom(_camera.zoom.x * factor)
	var after: Vector2 = _screen_to_world(screen_point)
	_camera.position += before - after
	_clamp_camera_position()


func _set_zoom(value: float) -> void:
	if _camera == null:
		return
	var clamped: float = clampf(value, _min_zoom, _max_zoom)
	_camera.zoom = Vector2.ONE * clamped
	if is_instance_valid(_zoom_label):
		_zoom_label.text = "масштаб %d%%" % int(round(clamped * 100.0))


func _clamp_camera_position() -> void:
	if _camera == null:
		return
	var margin: float = 180.0 / maxf(_camera.zoom.x, 0.01)
	var min_pos: Vector2 = _workspace_rect.position - Vector2.ONE * margin
	var max_pos: Vector2 = _workspace_rect.end + Vector2.ONE * margin
	_camera.position.x = clampf(_camera.position.x, min_pos.x, max_pos.x)
	_camera.position.y = clampf(_camera.position.y, min_pos.y, max_pos.y)


func _on_piece_locked(_piece: PuzzlePieceV3) -> void:
	_locked_count += 1
	_update_status()
	if _locked_count >= _piece_count:
		_show_complete_message()


func _update_status() -> void:
	if is_instance_valid(_status_label):
		_status_label.text = "%d / %d" % [_locked_count, _piece_count]
	if is_instance_valid(_zoom_label) and _camera != null:
		_zoom_label.text = "масштаб %d%%" % int(round(_camera.zoom.x * 100.0))


func _reshuffle_all() -> void:
	_locked_count = 0
	_active_piece = null
	for index in range(_pieces.size()):
		_pieces[index].place_scrambled(_scatter_position(index))
	_update_status()


func _show_complete_message() -> void:
	var screen_size: Vector2 = get_viewport_rect().size
	var label := Label.new()
	label.position = Vector2(screen_size.x * 0.5 - 230.0, 108.0)
	label.size = Vector2(460.0, 55.0)
	label.text = "Готово! Пазл собран 🎉"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 24)
	label.add_theme_color_override("font_color", Color(0.91, 0.97, 1.0, 1.0))
	_ui_layer.add_child(label)


func _back_to_modes() -> void:
	_destroy_world()
	_show_mode_menu()


func _destroy_world() -> void:
	_active_piece = null
	_panning = false
	_pieces.clear()
	if is_instance_valid(_world):
		_world.queue_free()
	_world = null
	if is_instance_valid(_camera):
		_camera.queue_free()
	_camera = null


func _clear_ui() -> void:
	if not is_instance_valid(_ui_layer):
		return
	for child in _ui_layer.get_children():
		_ui_layer.remove_child(child)
		child.queue_free()
	_status_label = null
	_zoom_label = null


func _show_message(title_text: String, body_text: String) -> void:
	_clear_ui()
	var screen_size: Vector2 = get_viewport_rect().size
	var title := Label.new()
	title.position = Vector2(60.0, 190.0)
	title.size = Vector2(screen_size.x - 120.0, 50.0)
	title.text = title_text
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 30)
	_ui_layer.add_child(title)

	var body := Label.new()
	body.position = Vector2(90.0, 260.0)
	body.size = Vector2(screen_size.x - 180.0, 220.0)
	body.text = body_text
	body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_theme_font_size_override("font_size", 19)
	body.add_theme_color_override("font_color", Color(0.62, 0.72, 0.84, 1.0))
	_ui_layer.add_child(body)
